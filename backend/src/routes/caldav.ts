/**
 * CalDAV Routes - Full CalDAV protocol support
 * Enables two-way sync with calendar clients (Thunderbird, Apple Calendar, etc.)
 */

import express, { Request, Response } from 'express'
import { query } from '../db'
import crypto from 'crypto'

const router = express.Router()

/**
 * Escape special characters in iCal text fields
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Format timestamp for iCal (YYYYMMDDTHHmmssZ)
 */
function formatICalTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Generate iCal for a single event
 */
function generateSingleEventICal(event: any): string {
  const timestamp = formatICalTimestamp(new Date())
  const created = formatICalTimestamp(event.created_at || new Date())
  const lastMod = formatICalTimestamp(event.last_modified || new Date())
  
  const eventDate = new Date(event.event_date)
  const year = eventDate.getFullYear()
  const month = String(eventDate.getMonth() + 1).padStart(2, '0')
  const day = String(eventDate.getDate()).padStart(2, '0')
  const dateStr = `${year}${month}${day}`
  
  const startTime = event.start_time.split(':')
  const endTime = event.end_time.split(':')
  const startTimeStr = `${startTime[0]}${startTime[1]}00`
  const endTimeStr = `${endTime[0]}${endTime[1]}00`
  
  const uid = `${event.id}@tigement.cz`
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tigement//NONSGML Day Planner//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${timestamp}
CREATED:${created}
LAST-MODIFIED:${lastMod}
DTSTART:${dateStr}T${startTimeStr}
DTEND:${dateStr}T${endTimeStr}
SUMMARY:${escapeICalText(event.title)}
DESCRIPTION:${escapeICalText(`Duration: ${event.duration_minutes} min`)}
SEQUENCE:${event.sequence || 0}
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
`
}

/**
 * Parse iCal event data
 */
function parseICalEvent(icalData: string): any {
  // Extract key fields using regex
  const summary = /SUMMARY:(.+)/.exec(icalData)?.[1]?.replace(/\\n/g, '\n').replace(/\\;/g, ';').replace(/\\,/g, ',') || ''
  const dtstart = /DTSTART[^:]*:(\d{8}T\d{6})/.exec(icalData)?.[1]
  const dtend = /DTEND[^:]*:(\d{8}T\d{6})/.exec(icalData)?.[1]
  
  if (!dtstart || !dtend) {
    throw new Error('Invalid iCal data - missing DTSTART or DTEND')
  }
  
  // Parse date and time
  const date = dtstart.substring(0, 8)
  const startTime = dtstart.substring(9, 11) + ':' + dtstart.substring(11, 13)
  const endTime = dtend.substring(9, 11) + ':' + dtend.substring(11, 13)
  
  // Calculate duration
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  const duration = (endH * 60 + endM) - (startH * 60 + startM)
  
  // Format date as YYYY-MM-DD
  const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`
  
  return {
    title: summary,
    date: formattedDate,
    startTime,
    endTime,
    duration
  }
}

/**
 * PROPFIND - Calendar collection discovery
 * Used by clients to discover calendar properties
 */
router.propfind('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const depth = req.headers.depth || '0'
    
    // Verify token and get user
    const tokenResult = await query(
      'SELECT user_id FROM ical_tokens WHERE token = $1',
      [token]
    )
    
    if (tokenResult.rows.length === 0) {
      return res.status(404).send('Calendar not found')
    }
    
    const userId = tokenResult.rows[0].user_id
    
    // If depth is 1, include all events in the response
    if (depth === '1') {
      const eventsResult = await query(
        `SELECT * FROM calendar_events 
         WHERE user_id = $1 
         AND event_date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY event_date, start_time`,
        [userId]
      )
      
      let response = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/caldav/${token}/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype>
          <D:collection/>
          <C:calendar/>
        </D:resourcetype>
        <D:displayname>Tigement Calendar</D:displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
        </C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
`
      
      // Add each event
      eventsResult.rows.forEach((event: any) => {
        response += `  <D:response>
    <D:href>/caldav/${token}/${event.id}.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"${event.etag}"</D:getetag>
        <D:getlastmodified>${new Date(event.last_modified).toUTCString()}</D:getlastmodified>
        <D:getcontenttype>text/calendar; component=vevent</D:getcontenttype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
`
      })
      
      response += '</D:multistatus>'
      
      res.set('Content-Type', 'application/xml; charset=utf-8')
      res.set('DAV', '1, 3, calendar-access')
      res.status(207).send(response)
    } else {
      // Depth 0 - just collection properties
      const propfindResponse = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/caldav/${token}/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype>
          <D:collection/>
          <C:calendar/>
        </D:resourcetype>
        <D:displayname>Tigement Calendar</D:displayname>
        <C:supported-calendar-component-set>
          <C:comp name="VEVENT"/>
        </C:supported-calendar-component-set>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`
      
      res.set('Content-Type', 'application/xml; charset=utf-8')
      res.set('DAV', '1, 3, calendar-access')
      res.status(207).send(propfindResponse)
    }
  } catch (error) {
    console.error('PROPFIND error:', error)
    res.status(500).send('Internal server error')
  }
})

/**
 * GET individual event with ETag support
 */
router.get('/:token/:uid.ics', async (req: Request, res: Response) => {
  try {
    const { token, uid } = req.params
    
    // Extract event ID from UID (remove .ics extension if present)
    const eventId = uid.replace('.ics', '')
    
    // Get event from database
    const eventResult = await query(
      `SELECT ce.*, it.user_id 
       FROM calendar_events ce
       JOIN ical_tokens it ON ce.user_id = it.user_id
       WHERE it.token = $1 AND ce.id::text = $2`,
      [token, eventId]
    )
    
    if (eventResult.rows.length === 0) {
      return res.status(404).send('Event not found')
    }
    
    const event = eventResult.rows[0]
    
    // Check If-None-Match header (client's ETag)
    const clientETag = req.headers['if-none-match']
    if (clientETag && clientETag === `"${event.etag}"`) {
      return res.status(304).send() // Not Modified
    }
    
    // Generate iCal for single event
    const ical = generateSingleEventICal(event)
    
    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('ETag', `"${event.etag}"`)
    res.set('Last-Modified', new Date(event.last_modified).toUTCString())
    res.send(ical)
  } catch (error) {
    console.error('GET event error:', error)
    res.status(500).send('Internal server error')
  }
})

/**
 * PUT - Create or update event
 */
router.put('/:token/:uid.ics', async (req: Request, res: Response) => {
  try {
    const { token, uid } = req.params
    const ifMatch = req.headers['if-match']
    
    // Extract event ID
    const eventId = uid.replace('.ics', '')
    
    // Verify token
    const tokenResult = await query(
      'SELECT user_id FROM ical_tokens WHERE token = $1',
      [token]
    )
    
    if (tokenResult.rows.length === 0) {
      return res.status(404).send('Calendar not found')
    }
    
    const userId = tokenResult.rows[0].user_id
    
    // Parse iCal body
    const icalData = req.body.toString('utf8')
    const eventData = parseICalEvent(icalData)
    
    // Check if event exists
    const existingEvent = await query(
      'SELECT etag FROM calendar_events WHERE user_id = $1 AND id::text = $2',
      [userId, eventId]
    )
    
    if (existingEvent.rows.length > 0) {
      // Update existing event
      // Verify ETag if If-Match header present
      if (ifMatch && ifMatch !== `"${existingEvent.rows[0].etag}"`) {
        return res.status(412).send('Precondition Failed - ETag mismatch')
      }
      
      // Update event
      const updateResult = await query(
        `UPDATE calendar_events 
         SET title = $1, event_date = $2, start_time = $3, end_time = $4, duration_minutes = $5
         WHERE user_id = $6 AND id::text = $7
         RETURNING etag`,
        [eventData.title, eventData.date, eventData.startTime, eventData.endTime, 
         eventData.duration, userId, eventId]
      )
      
      res.set('ETag', `"${updateResult.rows[0].etag}"`)
      res.status(204).send()
    } else {
      // Create new event
      const insertResult = await query(
        `INSERT INTO calendar_events 
         (id, user_id, title, event_date, start_time, end_time, duration_minutes, sequence)
         VALUES ($1::integer, $2, $3, $4, $5, $6, $7, 0)
         RETURNING etag`,
        [eventId, userId, eventData.title, eventData.date, eventData.startTime, 
         eventData.endTime, eventData.duration]
      )
      
      res.set('ETag', `"${insertResult.rows[0].etag}"`)
      res.status(201).send()
    }
  } catch (error) {
    console.error('PUT event error:', error)
    res.status(500).send('Internal server error')
  }
})

/**
 * DELETE event
 */
router.delete('/:token/:uid.ics', async (req: Request, res: Response) => {
  try {
    const { token, uid } = req.params
    const ifMatch = req.headers['if-match']
    
    // Extract event ID
    const eventId = uid.replace('.ics', '')
    
    // Verify token and get event
    const eventResult = await query(
      `SELECT ce.etag, it.user_id 
       FROM calendar_events ce
       JOIN ical_tokens it ON ce.user_id = it.user_id
       WHERE it.token = $1 AND ce.id::text = $2`,
      [token, eventId]
    )
    
    if (eventResult.rows.length === 0) {
      return res.status(404).send('Event not found')
    }
    
    // Verify ETag if If-Match header present
    if (ifMatch && ifMatch !== `"${eventResult.rows[0].etag}"`) {
      return res.status(412).send('Precondition Failed - ETag mismatch')
    }
    
    // Delete event
    await query(
      `DELETE FROM calendar_events ce
       USING ical_tokens it
       WHERE ce.user_id = it.user_id AND it.token = $1 AND ce.id::text = $2`,
      [token, eventId]
    )
    
    res.status(204).send()
  } catch (error) {
    console.error('DELETE event error:', error)
    res.status(500).send('Internal server error')
  }
})

/**
 * REPORT - Calendar query (CalDAV protocol)
 * Used by clients to efficiently query multiple events
 */
router.report('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    
    // Verify token
    const tokenResult = await query(
      'SELECT user_id FROM ical_tokens WHERE token = $1',
      [token]
    )
    
    if (tokenResult.rows.length === 0) {
      return res.status(404).send('Calendar not found')
    }
    
    const userId = tokenResult.rows[0].user_id
    
    // Get all events for this calendar
    const eventsResult = await query(
      `SELECT * FROM calendar_events 
       WHERE user_id = $1
       AND event_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY event_date, start_time`,
      [userId]
    )
    
    // Generate multi-status response with all events
    let response = `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
`
    
    eventsResult.rows.forEach((event: any) => {
      response += `  <D:response>
    <D:href>/caldav/${token}/${event.id}.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"${event.etag}"</D:getetag>
        <D:getlastmodified>${new Date(event.last_modified).toUTCString()}</D:getlastmodified>
        <D:getcontenttype>text/calendar; component=vevent</D:getcontenttype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
`
    })
    
    response += '</D:multistatus>'
    
    res.set('Content-Type', 'application/xml; charset=utf-8')
    res.set('DAV', '1, 3, calendar-access')
    res.status(207).send(response)
  } catch (error) {
    console.error('REPORT error:', error)
    res.status(500).send('Internal server error')
  }
})

export default router

