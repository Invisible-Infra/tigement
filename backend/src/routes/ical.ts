/**
 * iCal Routes - Live calendar subscription feed
 * Public endpoint for calendar apps to subscribe to user's tasks
 */

import express, { Request, Response } from 'express'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import crypto from 'crypto'

const router = express.Router()

/**
 * Generate iCal feed content from user's workspace data
 */
function generateICalFeed(tables: any[], userEmail: string): string {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tigement//Day Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Tigement Tasks',
    `X-WR-CALDESC:Task schedule for ${userEmail}`,
    'X-WR-TIMEZONE:UTC'
  ].join('\r\n')

  // Process only 'day' type tables with dates
  const dayTables = tables.filter((t: any) => t.type === 'day' && t.date && t.startTime)

  dayTables.forEach((table: any) => {
    const tableDate = new Date(table.date)
    const [startHour, startMinute] = table.startTime.split(':').map(Number)
    
    let currentTime = new Date(tableDate)
    currentTime.setHours(startHour, startMinute, 0, 0)

    table.tasks.forEach((task: any, index: number) => {
      // Skip empty tasks but still advance time to maintain correct schedule
      if (!task.title || task.title.trim() === '') {
        currentTime = new Date(currentTime.getTime() + task.duration * 60000)
        return
      }

      const startTime = new Date(currentTime)
      const endTime = new Date(currentTime.getTime() + task.duration * 60000)
      
      // Format: YYYYMMDDTHHmmssZ
      const dtstart = startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      const dtend = endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      
      // Generate unique UID
      const uid = crypto.createHash('md5')
        .update(`${userEmail}-${table.id}-${task.id}-${dtstart}`)
        .digest('hex')

      ical += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${uid}@tigement.com`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeICalText(task.title)}`,
        `DESCRIPTION:${escapeICalText(`Duration: ${task.duration} min`)}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'SEQUENCE:0',
        'END:VEVENT'
      ].join('\r\n')

      // Move current time forward by task duration
      currentTime = endTime
    })
  })

  ical += '\r\nEND:VCALENDAR\r\n'
  return ical
}

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
 * POST /api/ical/sync
 * Authenticated endpoint - Update calendar events for iCal feed
 * Called by frontend whenever user saves day tables
 */
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { dayTables } = req.body

    if (!Array.isArray(dayTables)) {
      return res.status(400).json({ error: 'dayTables must be an array' })
    }

    // Check if user has active premium subscription
    const subscriptionResult = await query(
      `SELECT plan, status FROM subscriptions WHERE user_id = $1`,
      [userId]
    )

    if (subscriptionResult.rows.length === 0 || 
        subscriptionResult.rows[0].plan !== 'premium' || 
        subscriptionResult.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'iCal sync requires active premium subscription' })
    }

    // Check if user has enabled iCal export (has a token)
    const tokenResult = await query(
      `SELECT token FROM ical_tokens WHERE user_id = $1`,
      [userId]
    )

    if (tokenResult.rows.length === 0) {
      return res.status(403).json({ error: 'iCal export not enabled. Enable it in Profile settings first.' })
    }

    // Delete all existing calendar events for this user
    await query('DELETE FROM calendar_events WHERE user_id = $1', [userId])

    // Insert new calendar events
    for (const table of dayTables) {
      if (table.type !== 'day' || !table.date || !table.startTime) continue

      const tableDate = new Date(table.date)
      const [startHour, startMinute] = table.startTime.split(':').map(Number)
      
      let currentTime = new Date(tableDate)
      currentTime.setHours(startHour, startMinute, 0, 0)

      for (const task of table.tasks) {
        const startTime = new Date(currentTime)
        const endTime = new Date(currentTime.getTime() + task.duration * 60000)

        // Skip empty tasks or placeholder text, but still advance time
        if (!task.title || task.title.trim() === '' || task.title === 'Task name...') {
          currentTime = endTime
          continue
        }

        // Note: created_at, last_modified, sequence, and etag are automatically
        // set by database triggers (see migration 022_caldav_support.sql)
        // Note: We delete all events before inserting, so no conflicts expected
        await query(
          `INSERT INTO calendar_events (user_id, event_date, start_time, end_time, title, duration_minutes, table_id, task_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            tableDate.toISOString().split('T')[0],
            startTime.toTimeString().split(' ')[0],
            endTime.toTimeString().split(' ')[0],
            task.title.trim(),
            task.duration,
            table.id,
            task.id
          ]
        )

        currentTime = endTime
      }
    }

    res.json({ success: true, message: 'Calendar events synced' })
  } catch (error) {
    console.error('Calendar sync error:', error)
    res.status(500).json({ error: 'Failed to sync calendar' })
  }
})

/**
 * GET /api/ical/status
 * Authenticated endpoint - Check if iCal export is enabled (without creating token)
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    // Check if user has premium subscription
    const subscriptionResult = await query(
      `SELECT plan, status FROM subscriptions WHERE user_id = $1`,
      [userId]
    )

    if (subscriptionResult.rows.length === 0 || 
        subscriptionResult.rows[0].plan !== 'premium' || 
        subscriptionResult.rows[0].status !== 'active') {
      return res.json({ enabled: false, url: null })
    }

    // Check if token exists
    const tokenResult = await query(
      'SELECT token FROM ical_tokens WHERE user_id = $1',
      [userId]
    )

    if (tokenResult.rows.length === 0) {
      return res.json({ enabled: false, url: null })
    }

    // Construct base URL
    let baseUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')
      const host = req.headers['x-forwarded-host'] || req.headers.host
      baseUrl = `${protocol}://${host}`
    }

    const token = tokenResult.rows[0].token
    return res.json({ 
      enabled: true, 
      url: `${baseUrl}/api/ical/${token}` 
    })
  } catch (error) {
    console.error('iCal status check error:', error)
    res.status(500).json({ error: 'Failed to check iCal status' })
  }
})

/**
 * POST /api/ical/generate-token
 * Authenticated endpoint - Generate or retrieve iCal subscription token
 */
router.post('/generate-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    console.log(`Generating iCal token for user ${userId}`)

    // Check if user has active premium subscription
    const subscriptionResult = await query(
      `SELECT plan, status FROM subscriptions WHERE user_id = $1`,
      [userId]
    )

    if (subscriptionResult.rows.length === 0 || 
        subscriptionResult.rows[0].plan !== 'premium' || 
        subscriptionResult.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'iCal export requires active premium subscription' })
    }

    // Construct base URL from request or environment
    // For production: use BACKEND_URL, for dev/Cloudflare Tunnel: use request host
    let baseUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL
    
    if (!baseUrl) {
      // Construct from request
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')
      const host = req.headers['x-forwarded-host'] || req.headers.host
      baseUrl = `${protocol}://${host}`
    }

    console.log(`Base URL for iCal: ${baseUrl}`)

    // Check if token already exists
    const existing = await query(
      'SELECT token FROM ical_tokens WHERE user_id = $1',
      [userId]
    )

    if (existing.rows.length > 0) {
      const token = existing.rows[0].token
      console.log(`Found existing token for user ${userId}`)
      return res.json({ 
        token,
        url: `${baseUrl}/api/ical/${token}`
      })
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex')
    console.log(`Generated new token for user ${userId}`)
    
    await query(
      'INSERT INTO ical_tokens (user_id, token) VALUES ($1, $2)',
      [userId, token]
    )

    console.log(`Successfully created iCal token for user ${userId}`)
    res.json({ 
      token,
      url: `${baseUrl}/api/ical/${token}`
    })
  } catch (error: any) {
    console.error('Generate token error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    })
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error.message 
    })
  }
})

/**
 * GET /api/ical/:token
 * Public endpoint - Returns iCal feed for calendar subscription
 */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    // Find user by iCal token
    const tokenResult = await query(
      'SELECT user_id FROM ical_tokens WHERE token = $1',
      [token]
    )

    if (tokenResult.rows.length === 0) {
      return res.status(404).send('Calendar feed not found')
    }

    const userId = tokenResult.rows[0].user_id

    // Check if user has active premium subscription
    const subscriptionResult = await query(
      `SELECT plan, status, expires_at FROM subscriptions WHERE user_id = $1`,
      [userId]
    )

    if (subscriptionResult.rows.length === 0) {
      return res.status(403).send('Calendar feed requires premium subscription')
    }

    const subscription = subscriptionResult.rows[0]
    
    // Check if subscription is active
    if (subscription.status !== 'active') {
      return res.status(403).send('Calendar feed requires active premium subscription')
    }

    // Check if subscription has expired
    if (subscription.plan === 'premium' && subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      return res.status(403).send('Premium subscription has expired')
    }

    // Get user email
    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId])
    const userEmail = userResult.rows[0]?.email || 'user'

    // Get calendar events
    const eventsResult = await query(
      `SELECT * FROM calendar_events 
       WHERE user_id = $1 
       AND event_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY event_date, start_time`,
      [userId]
    )

    // Generate iCal feed
    const now = new Date()
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    
    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tigement.com//NONSGML Day Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Tigement',
      'NAME:Tigement',
      'X-WR-RELCALID:' + token,
      `X-WR-CALDESC:Task schedule for ${userEmail}`,
      'X-APPLE-CALENDAR-COLOR:#4fc3f7',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H'
    ].join('\r\n')

    eventsResult.rows.forEach((event: any) => {
      // Format date as YYYYMMDD
      const eventDate = new Date(event.event_date)
      const year = eventDate.getFullYear()
      const month = String(eventDate.getMonth() + 1).padStart(2, '0')
      const day = String(eventDate.getDate()).padStart(2, '0')
      const dateStr = `${year}${month}${day}`
      
      // Format time as HHMMSS (local time, no timezone conversion)
      const startTime = event.start_time.split(':')
      const endTime = event.end_time.split(':')
      const startTimeStr = `${startTime[0]}${startTime[1]}00`
      const endTimeStr = `${endTime[0]}${endTime[1]}00`
      
      // Use floating time (no timezone) - format: YYYYMMDDTHHmmss (no Z suffix)
      const dtstart = `${dateStr}T${startTimeStr}`
      const dtend = `${dateStr}T${endTimeStr}`
      
      const uid = crypto.createHash('md5')
        .update(`${userEmail}-${event.id}-${dtstart}`)
        .digest('hex')

      // Format timestamps for CalDAV compliance
      const created = event.created_at 
        ? new Date(event.created_at).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : timestamp
      const lastModified = event.last_modified
        ? new Date(event.last_modified).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : timestamp
      const sequence = event.sequence || 0

      ical += '\r\n' + [
        'BEGIN:VEVENT',
        `UID:${uid}@tigement.com`,
        `DTSTAMP:${timestamp}`,
        `CREATED:${created}`,
        `LAST-MODIFIED:${lastModified}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeICalText(event.title)}`,
        `DESCRIPTION:${escapeICalText(`Duration: ${event.duration_minutes} min`)}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        `SEQUENCE:${sequence}`,
        'END:VEVENT'
      ].join('\r\n')
    })

    ical += '\r\nEND:VCALENDAR\r\n'

    res.set('Content-Type', 'text/calendar; charset=utf-8; name="Tigement.ics"')
    res.set('Content-Disposition', 'inline; filename="Tigement.ics"')
    res.set('Cache-Control', 'no-cache, must-revalidate')
    res.set('X-WR-CALNAME', 'Tigement')
    res.send(ical)

  } catch (error) {
    console.error('iCal feed error:', error)
    res.status(500).send('Internal server error')
  }
})

/**
 * DELETE /api/ical/disable
 * Authenticated endpoint - Disable iCal export and delete all calendar data
 * Called when user opts out of iCal export feature
 */
router.delete('/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    console.log(`Disabling iCal export for user ${userId}`)

    // Check if user has premium subscription (even expired can disable)
    const subscriptionResult = await query(
      `SELECT plan FROM subscriptions WHERE user_id = $1`,
      [userId]
    )

    if (subscriptionResult.rows.length === 0 || 
        subscriptionResult.rows[0].plan !== 'premium') {
      return res.status(403).json({ error: 'iCal export is only available for premium users' })
    }

    // Delete all calendar events for this user
    await query('DELETE FROM calendar_events WHERE user_id = $1', [userId])
    
    // Delete the iCal token (invalidates subscription URL)
    await query('DELETE FROM ical_tokens WHERE user_id = $1', [userId])

    console.log(`Successfully disabled iCal export and deleted data for user ${userId}`)
    res.json({ 
      success: true, 
      message: 'iCal export disabled and all calendar data deleted from server' 
    })
  } catch (error) {
    console.error('Disable iCal error:', error)
    res.status(500).json({ error: 'Failed to disable iCal export' })
  }
})

export default router

