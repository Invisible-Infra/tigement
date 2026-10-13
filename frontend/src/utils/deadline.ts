/** How long before a deadline the row turns yellow. */
export const DEADLINE_SOON_MS = 24 * 60 * 60 * 1000

export type DeadlineStatus = 'overdue' | 'soon' | 'none'

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, '0')
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function isRealTime(hours: number, minutes: number): boolean {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * Canonical deadline string.
 * '' means cleared. null means the value is not a date or a local date-time.
 * A date-only value is never rewritten as midnight.
 */
export function normalizeDeadline(value: unknown): string | null {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') return null

  const dateOnly = value.match(DATE_ONLY)
  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    if (!isRealDate(year, month, day)) return null
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
  }

  const dateTime = value.match(DATE_TIME)
  if (dateTime) {
    const year = Number(dateTime[1])
    const month = Number(dateTime[2])
    const day = Number(dateTime[3])
    const hours = Number(dateTime[4])
    const minutes = Number(dateTime[5])
    if (!isRealDate(year, month, day) || !isRealTime(hours, minutes)) return null
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`
  }

  return null
}

export function splitDeadline(deadline: string | null | undefined): { date: string; time: string } {
  const normalized = typeof deadline === 'string' ? normalizeDeadline(deadline) : ''
  if (!normalized) return { date: '', time: '' }
  const splitAt = normalized.indexOf('T')
  if (splitAt === -1) return { date: normalized, time: '' }
  return { date: normalized.slice(0, splitAt), time: normalized.slice(splitAt + 1) }
}

/** Join a date and an optional time. '' clears. null rejects a time with no date. */
export function composeDeadline(date: string, time: string): string | null {
  const datePart = date.trim()
  const timePart = time.trim()
  if (!datePart && !timePart) return ''
  if (!datePart) return null
  if (!timePart) return normalizeDeadline(datePart)
  return normalizeDeadline(`${datePart}T${timePart}`)
}

export function deadlineStatus(deadline: string | null | undefined, now: Date): DeadlineStatus {
  const normalized = typeof deadline === 'string' ? normalizeDeadline(deadline) : ''
  if (!normalized) return 'none'

  const dateOnly = normalized.match(DATE_ONLY)
  if (dateOnly) {
    const dueEnd = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]) + 1, 0, 0, 0, 0)
    if (now.getTime() >= dueEnd.getTime()) return 'overdue'
    if (dueEnd.getTime() - now.getTime() <= DEADLINE_SOON_MS) return 'soon'
    return 'none'
  }

  const dateTime = normalized.match(DATE_TIME)
  if (!dateTime) return 'none'
  const due = new Date(
    Number(dateTime[1]),
    Number(dateTime[2]) - 1,
    Number(dateTime[3]),
    Number(dateTime[4]),
    Number(dateTime[5]),
    0,
    0
  )
  if (now.getTime() >= due.getTime()) return 'overdue'
  if (due.getTime() - now.getTime() <= DEADLINE_SOON_MS) return 'soon'
  return 'none'
}

export function deadlineRowClass(status: DeadlineStatus): string {
  if (status === 'overdue') return 'bg-red-200 text-red-900'
  if (status === 'soon') return 'bg-yellow-200 text-yellow-900'
  return ''
}

export function deadlineBackgroundHex(status: DeadlineStatus): string | null {
  if (status === 'overdue') return '#fecaca'
  if (status === 'soon') return '#fef08c'
  return null
}

export function deadlineTextColor(status: DeadlineStatus): string | null {
  if (status === 'overdue') return 'rgb(127, 29, 29)'
  if (status === 'soon') return 'rgb(113, 63, 18)'
  return null
}
