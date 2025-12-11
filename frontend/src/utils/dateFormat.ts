import { loadSettings } from './storage'

/**
 * Normalize a date string to YYYY-MM-DD format
 * Handles various input formats and timezone issues
 * @param dateStr - Date string in various formats
 * @returns Normalized YYYY-MM-DD string or null if invalid
 */
export function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  // If already in YYYY-MM-DD format, validate and return
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    if (isValidDateFormat(dateStr)) {
      return dateStr
    }
    return null
  }
  
  // Try to parse as Date object
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return null
  }
  
  // Extract components using local date (not UTC) to avoid timezone shifts
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  // Return in YYYY-MM-DD format
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

/**
 * Format a date string according to user's date format preference
 * @param dateStr - Date string in YYYY-MM-DD format or ISO string
 * @param dateFormat - Optional date format override (defaults to user settings)
 * @returns Formatted date string
 */
export function formatDateWithSettings(dateStr: string, dateFormat?: string): string {
  // Validate input
  if (!dateStr) {
    return 'Invalid Date'
  }

  // Normalize the date first
  const normalized = normalizeDate(dateStr)
  if (!normalized) {
    console.warn('Invalid date string:', dateStr)
    return 'Invalid Date'
  }

  // Get date format from settings if not provided
  if (!dateFormat) {
    const settings = loadSettings()
    dateFormat = settings?.dateFormat || 'DD. MM. YYYY'
  }

  // Parse the normalized date (guaranteed to be YYYY-MM-DD)
  const parts = normalized.split('-')
  const year = parts[0]
  const month = parts[1]
  const day = parts[2]

  // Format according to user preference
  switch (dateFormat) {
    case 'DD. MM. YYYY':
      return `${day}. ${month}. ${year}`
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      // Fallback to DD. MM. YYYY
      return `${day}. ${month}. ${year}`
  }
}

/**
 * Format a date for display in diary/list views (more readable format)
 * Uses user's date format preference
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param dateFormat - Optional date format override
 * @returns Formatted date string
 */
export function formatDateDisplay(dateStr: string, dateFormat?: string): string {
  return formatDateWithSettings(dateStr, dateFormat)
}

/**
 * Validate if a date string is in valid YYYY-MM-DD format
 * @param dateStr - Date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr) return false
  // Check YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  
  // Validate the actual date
  const parts = dateStr.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  
  // Basic validation - could be more strict
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day
}

