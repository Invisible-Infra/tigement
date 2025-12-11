export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24  // Add modulo 24 for day rollover
  const newMinutes = totalMinutes % 60
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
}

export function parseDuration(duration: string): number {
  const [hours, minutes] = duration.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function isValidDurationFormat(duration: string): boolean {
  return /^([0-9]{2}):([0-9]{2})$/.test(duration)
}

export function isValidDuration(duration: string): boolean {
  if (!isValidDurationFormat(duration)) return false
  
  const [hours, minutes] = duration.split(':').map(Number)
  
  // Validate hours and minutes are within reasonable ranges
  if (hours < 0 || hours > 23) return false
  if (minutes < 0 || minutes > 59) return false
  
  // Ensure total duration is not zero
  return (hours * 60 + minutes) > 0
}

export function sanitizeDuration(duration: string): string {
  if (!isValidDurationFormat(duration)) return '00:30' // default duration
  if (!isValidDuration(duration)) return '00:30' // default duration
  return duration
} 