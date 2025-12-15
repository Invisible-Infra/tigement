// Client-side iCal (.ics) export utility
// Generates RFC 5545 compliant iCalendar files from day tables

import { Table } from '../types'

/**
 * Escape special characters for iCalendar format (RFC 5545)
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Format date-time for iCalendar (YYYYMMDDTHHMMSSZ in UTC)
 */
function formatICalDateTime(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

/**
 * Generate a unique UID for an event (RFC 5545 requirement)
 */
function generateUID(tableId: number, taskIndex: number, domain: string = 'tigement.com'): string {
  return `task-${tableId}-${taskIndex}@${domain}`
}

/**
 * Convert day tables to iCalendar format
 */
export function generateICS(dayTables: Table[]): string {
  const now = new Date()
  const lines: string[] = []

  // iCalendar header
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//Tigement//Task Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:Tigement Tasks')
  lines.push('X-WR-TIMEZONE:UTC')
  lines.push('X-WR-CALDESC:Tasks exported from Tigement')

  // Process each day table
  for (const table of dayTables) {
    if (table.type !== 'day' || !table.date) continue

    try {
      const tableDate = new Date(table.date)
      let currentTime = new Date(tableDate)

      // Process each task in the day
      for (let i = 0; i < table.tasks.length; i++) {
        const task = table.tasks[i]
        
        // Skip empty/placeholder tasks
        if (!task.title?.trim() && !task.description?.trim()) {
          // Still advance time for empty slots
          currentTime = new Date(currentTime.getTime() + (task.duration || 30) * 60000)
          continue
        }

        const duration = task.duration || 30
        const startTime = new Date(currentTime)
        const endTime = new Date(startTime.getTime() + duration * 60000)

        // Create VEVENT
        lines.push('BEGIN:VEVENT')
        lines.push(`UID:${generateUID(table.id, i)}`)
        lines.push(`DTSTAMP:${formatICalDateTime(now)}`)
        lines.push(`DTSTART:${formatICalDateTime(startTime)}`)
        lines.push(`DTEND:${formatICalDateTime(endTime)}`)
        lines.push(`SUMMARY:${escapeICalText(task.title || 'Untitled Task')}`)
        
        if (task.description?.trim()) {
          lines.push(`DESCRIPTION:${escapeICalText(task.description)}`)
        }

        // Add status
        const status = task.status === 'done' ? 'COMPLETED' : 
                      task.status === 'in-progress' ? 'IN-PROCESS' : 
                      'NEEDS-ACTION'
        lines.push(`STATUS:${status}`)

        // Add completion timestamp if done
        if (task.status === 'done') {
          lines.push(`COMPLETED:${formatICalDateTime(endTime)}`)
        }

        lines.push('END:VEVENT')

        // Advance current time for next task
        currentTime = endTime
      }
    } catch (error) {
      console.error(`Failed to process table ${table.id}:`, error)
    }
  }

  // iCalendar footer
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

/**
 * Download ICS file to user's device
 */
export function downloadICS(dayTables: Table[], filename: string = 'tigement-tasks.ics'): void {
  const icsContent = generateICS(dayTables)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  
  // Cleanup
  URL.revokeObjectURL(url)
}

