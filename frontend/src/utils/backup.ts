/**
 * Backup utility - Export all workspace data as JSON
 */

import { loadTables, loadSettings, loadTaskGroups, loadNotebooks, loadArchivedTables, loadDiaryEntries, saveTables, saveSettings, saveTaskGroups, saveNotebooks, saveArchivedTables, saveDiaryEntries } from './storage'
import { syncManager } from './syncManager'
import { api } from './api'

export interface BackupData {
  version: string
  exportedAt: string
  tables: any[]
  settings: any
  taskGroups: any[]
  notebooks: { workspace: string; tasks: Record<string, string> }
  archivedTables: any[]
  diaries?: Record<string, string> // Date (YYYY-MM-DD) -> content mapping
  _warnings?: string[] // Optional warnings about data integrity
}

/**
 * Export all workspace data to JSON
 */
export function exportBackup(): string {
  const tables = loadTables() || []
  const settings = loadSettings() || {}
  const taskGroups = loadTaskGroups() || []
  const notebooks = loadNotebooks() || { workspace: '', tasks: {} }
  const archivedTables = loadArchivedTables() || []
  const diaries = loadDiaryEntries() || {}

  // Warn if taskGroups is empty - this might indicate data corruption
  const warnings: string[] = []
  if (taskGroups.length === 0) {
    console.warn('⚠️ WARNING: Exporting backup with EMPTY taskGroups. This may indicate data loss or corruption.')
    warnings.push('taskGroups is empty - may indicate data loss')
  }

  const backup: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    tables,
    settings,
    taskGroups,
    notebooks,
    archivedTables,
    diaries,
    _warnings: warnings.length > 0 ? warnings : undefined
  }

  console.log(`📦 Backup created with ${Object.keys(diaries).length} diary entries`)
  return JSON.stringify(backup, null, 2)
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(jsonData: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const filename = `tigement-backup-${timestamp}.json`
  
  const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Validate backup JSON structure
 */
export function validateBackup(jsonString: string): { valid: boolean; data?: BackupData; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    
    // Check if it's a valid backup structure
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid backup format: not a valid JSON object' }
    }
    
    // Check required fields
    if (typeof parsed.version !== 'string') {
      return { valid: false, error: 'Invalid backup format: missing or invalid version field' }
    }
    
    if (typeof parsed.exportedAt !== 'string') {
      return { valid: false, error: 'Invalid backup format: missing or invalid exportedAt field' }
    }
    
    // Validate structure - arrays should be arrays, objects should be objects
    if (!Array.isArray(parsed.tables)) {
      return { valid: false, error: 'Invalid backup format: tables must be an array' }
    }
    
    if (!parsed.settings || typeof parsed.settings !== 'object') {
      return { valid: false, error: 'Invalid backup format: settings must be an object' }
    }
    
    if (!Array.isArray(parsed.taskGroups)) {
      return { valid: false, error: 'Invalid backup format: taskGroups must be an array' }
    }
    
    if (!parsed.notebooks || typeof parsed.notebooks !== 'object') {
      return { valid: false, error: 'Invalid backup format: notebooks must be an object' }
    }
    
    if (!Array.isArray(parsed.archivedTables)) {
      return { valid: false, error: 'Invalid backup format: archivedTables must be an array' }
    }
    
    // Validate notebooks structure
    if (typeof parsed.notebooks.workspace !== 'string') {
      return { valid: false, error: 'Invalid backup format: notebooks.workspace must be a string' }
    }
    
    if (!parsed.notebooks.tasks || typeof parsed.notebooks.tasks !== 'object') {
      return { valid: false, error: 'Invalid backup format: notebooks.tasks must be an object' }
    }
    
    // Validate diaries structure (optional field)
    if (parsed.diaries !== undefined) {
      if (typeof parsed.diaries !== 'object' || Array.isArray(parsed.diaries)) {
        return { valid: false, error: 'Invalid backup format: diaries must be an object (not array)' }
      }
    }
    
    return { valid: true, data: parsed as BackupData }
  } catch (error: any) {
    return { valid: false, error: `Failed to parse backup JSON: ${error.message}` }
  }
}

/**
 * Import backup data - replaces all existing data
 */
export async function importBackup(backupData: BackupData): Promise<void> {
  // Store debug info in sessionStorage before reload
  const debugInfo: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    debugInfo.push(msg)
  }
  const error = (msg: string) => {
    console.error(msg)
    debugInfo.push(`ERROR: ${msg}`)
  }
  
  log('📦 Starting backup restore...')
  log(`📦 Backup data: tables=${backupData.tables?.length || 0}, taskGroups=${backupData.taskGroups?.length || 0}, diaries=${Object.keys(backupData.diaries || {}).length}`)
  
  // CRITICAL: Set flag to prevent server pull from overwriting restored data
  sessionStorage.setItem('tigement_backup_restored', 'true')
  log('🛑 Set backup restore flag - will skip server pull on next load')
  
  // CRITICAL: Pause auto-sync for 30 seconds to prevent overwrite
  syncManager.pauseAutoSync(30000)
  log('🛑 Auto-sync paused during backup restore')
  
  // Ensure tables have required fields (position) to prevent UI crashes
  const tablesWithDefaults = (backupData.tables || []).map((table: any, index: number) => {
    // Ensure position exists (required for web UI rendering)
    if (!table.position || typeof table.position !== 'object') {
      table.position = {
        x: 20 + index * 100,
        y: 20 + index * 50
      }
    }
    return table
  })
  
  log(`📦 Restoring ${tablesWithDefaults.length} tables from backup`)
  if (tablesWithDefaults.length > 0) {
    log(`📦 First table: id=${tablesWithDefaults[0].id}, title=${tablesWithDefaults[0].title || '(no title)'}, tasks=${tablesWithDefaults[0].tasks?.length || 0}`)
  }
  
  if (tablesWithDefaults.length === 0 && (backupData.tables?.length || 0) > 0) {
    error('⚠️ WARNING: Tables were filtered out during restore!')
    error(`⚠️ Original tables count: ${backupData.tables.length}`)
  }
  
  // Replace all data with backup data
  saveTables(tablesWithDefaults)
  log(`✅ Saved ${tablesWithDefaults.length} tables to localStorage`)
  
  // Verify it was saved correctly
  const verifyTables = loadTables()
  log(`✅ Verified: ${verifyTables?.length || 0} tables in localStorage after save`)
  
  if (verifyTables?.length !== tablesWithDefaults.length) {
    error(`⚠️ MISMATCH: Saved ${tablesWithDefaults.length} but found ${verifyTables?.length || 0} in localStorage!`)
  }
  
  // Double-check by reading raw localStorage
  const rawTables = localStorage.getItem('tigement_tables')
  if (rawTables) {
    try {
      const parsed = JSON.parse(rawTables)
      log(`✅ Raw localStorage check: ${Array.isArray(parsed) ? parsed.length : 'not array'} items`)
      if (Array.isArray(parsed) && parsed.length > 0) {
        log(`✅ First table in raw data: id=${parsed[0].id}, title=${parsed[0].title || '(no title)'}`)
      }
    } catch (e) {
      error(`⚠️ Failed to parse raw localStorage: ${e}`)
    }
  } else {
    error('⚠️ Raw localStorage is NULL after save!')
  }
  
  // Store debug logs in sessionStorage so they survive reload
  sessionStorage.setItem('tigement_backup_restore_logs', JSON.stringify(debugInfo))
  
  saveSettings(backupData.settings || {})
  // Only save taskGroups if the array is not empty
  // An empty array would cause the app to show no groups
  if (backupData.taskGroups && backupData.taskGroups.length > 0) {
    saveTaskGroups(backupData.taskGroups)
  }
  // If taskGroups is empty or missing, don't save anything,
  // and let the app fall back to defaults on next load
  saveNotebooks({
    workspace: backupData.notebooks?.workspace || '',
    tasks: backupData.notebooks?.tasks || {}
  })
  saveArchivedTables(backupData.archivedTables || [])
  
  // Restore diaries (if present in backup)
  if (backupData.diaries) {
    saveDiaryEntries(backupData.diaries)
    log(`📔 Restored ${Object.keys(backupData.diaries).length} diary entries`)
  }
  
  // Push restored data to server immediately (for premium users with active subscription)
  try {
    const user = await api.getCurrentUser()
    // Check if user has active premium (not expired)
    const hasActivePremium = user?.plan === 'premium' && 
                             (user?.subscription_status === 'active' || user?.in_grace_period) &&
                             (!user?.expires_at || (() => {
                               const expiresAt = new Date(user.expires_at)
                               const now = new Date()
                               const gracePeriodDays = 3
                               const gracePeriodEnd = new Date(expiresAt)
                               gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)
                               return now <= gracePeriodEnd
                             })())
    
    if (hasActivePremium) {
      log('☁️ Pushing restored backup to server...')
      await syncManager.forcePush()
      log('✅ Backup pushed to server successfully')
      
      // Also push diary entries to server
      if (backupData.diaries) {
        // Note: Diary entries are now synced via encrypted workspace, not individual endpoints
        // The diaries are already included in the workspace push above
        log(`ℹ️ Diaries are synced via encrypted workspace (${Object.keys(backupData.diaries).length} entries)`)
      }
    } else {
      log('⏭️ Skipping server push - user does not have active premium subscription')
    }
  } catch (error) {
    error(`⚠️ Failed to push backup to server: ${error}`)
    // Continue anyway - data is restored locally
  }
}
