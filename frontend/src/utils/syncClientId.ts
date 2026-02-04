const STORAGE_KEY = 'tigement_sync_client_id'

export function getSyncClientId(): string {
  // In non-browser environments (SSR/tests), just return a static ID
  if (typeof window === 'undefined') {
    return 'server'
  }

  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length > 0) {
      return existing
    }
  } catch {
    // Ignore localStorage access errors and fall through to generate a new ID
  }

  let newId: string
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    newId = (crypto as any).randomUUID()
  } else {
    newId = `client-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  }

  try {
    localStorage.setItem(STORAGE_KEY, newId)
  } catch {
    // Ignore localStorage write errors; ID will be regenerated next time if needed
  }

  return newId
}

