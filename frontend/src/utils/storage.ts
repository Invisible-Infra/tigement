const STORAGE_KEYS = {
  TABLES: 'tigement_tables',
  SETTINGS: 'tigement_settings',
  TASK_GROUPS: 'tigement_task_groups',
  NOTEBOOKS: 'tigement_notebooks',
  ARCHIVED_TABLES: 'tigement_archived_tables',
  DIARY_ENTRIES: 'tigement_diary_entries',
  ANON_MERGE_FLAG: 'tigement_anon_merge_prompt_shown',
  STASH_PREFIX: 'tigement_stash_' // used to stash anon data after merge
}

export interface StorageSettings {
  defaultDuration: number
  defaultStartTime: string
  defaultTasksCount: number
  timeFormat: 12 | 24
  dateFormat: string
  showTimerOnStartup: boolean
  sessionDuration: number // days before auto-logout
  useTimePickers?: boolean
  durationPresets?: number[]
}

export function saveTables(tables: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables))
  } catch (error) {
    console.error('Failed to save tables:', error)
  }
}

export function loadTables(): any[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TABLES)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load tables:', error)
    return null
  }
}

export function saveSettings(settings: StorageSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export function loadSettings(): StorageSettings | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load settings:', error)
    return null
  }
}

export function saveTaskGroups(groups: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TASK_GROUPS, JSON.stringify(groups))
  } catch (error) {
    console.error('Failed to save task groups:', error)
  }
}

export function loadTaskGroups(): any[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TASK_GROUPS)
    if (!data) return null
    
    const parsed = JSON.parse(data)
    // If the array is empty, treat it as if there's no saved data
    // This prevents the issue where an empty array was saved (e.g., from a bad backup)
    // and prevents fallback to defaults
    if (Array.isArray(parsed) && parsed.length === 0) {
      return null
    }
    
    return parsed
  } catch (error) {
    console.error('Failed to load task groups:', error)
    return null
  }
}

export function saveNotebooks(notebooks: { workspace: string; tasks: Record<string, string> }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTEBOOKS, JSON.stringify(notebooks))
  } catch (error) {
    console.error('Failed to save notebooks:', error)
  }
}

export function loadNotebooks(): { workspace: string; tasks: Record<string, string> } | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.NOTEBOOKS)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load notebooks:', error)
    return null
  }
}

export function saveArchivedTables(archives: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ARCHIVED_TABLES, JSON.stringify(archives))
  } catch (error) {
    console.error('Failed to save archived tables:', error)
  }
}

export function loadArchivedTables(): any[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ARCHIVED_TABLES)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load archived tables:', error)
    return null
  }
}

export function saveDiaryEntries(entries: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DIARY_ENTRIES, JSON.stringify(entries))
  } catch (error) {
    console.error('Failed to save diary entries:', error)
  }
}

export function loadDiaryEntries(): Record<string, string> | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DIARY_ENTRIES)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load diary entries:', error)
    return null
  }
}

export function clearAllData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TABLES)
    localStorage.removeItem(STORAGE_KEYS.SETTINGS)
    localStorage.removeItem(STORAGE_KEYS.TASK_GROUPS)
    localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS)
    localStorage.removeItem(STORAGE_KEYS.ARCHIVED_TABLES)
    localStorage.removeItem(STORAGE_KEYS.DIARY_ENTRIES)
  } catch (error) {
    console.error('Failed to clear data:', error)
  }
}

// Anonymous merge helpers
export function hasShownAnonMergePrompt(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.ANON_MERGE_FLAG) === '1'
  } catch {
    return false
  }
}

export function setShownAnonMergePrompt(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ANON_MERGE_FLAG, '1')
  } catch {}
}

export function stashAnonDataSnapshot(label: string, tables: any[] | null, notebooks: { workspace?: string; tasks?: Record<string, string> } | null): void {
  try {
    const key = STORAGE_KEYS.STASH_PREFIX + label
    const payload = JSON.stringify({ tables, notebooks, at: new Date().toISOString() })
    localStorage.setItem(key, payload)
  } catch (e) {
    console.warn('Failed to stash anon snapshot', e)
  }
}

export function loadStashedAnonData(label: string): { tables: any[] | null; notebooks: { workspace?: string; tasks?: Record<string, string> } | null } | null {
  try {
    const key = STORAGE_KEYS.STASH_PREFIX + label
    const data = localStorage.getItem(key)
    if (!data) return null
    const parsed = JSON.parse(data)
    return { tables: parsed.tables || null, notebooks: parsed.notebooks || null }
  } catch {
    return null
  }
}

export function clearStashedAnonData(label: string): void {
  try {
    const key = STORAGE_KEYS.STASH_PREFIX + label
    localStorage.removeItem(key)
  } catch {}
}

export function clearAnonLocalData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TABLES)
    localStorage.removeItem(STORAGE_KEYS.NOTEBOOKS)
  } catch (e) {
    console.warn('Failed to clear anon local data', e)
  }
}
