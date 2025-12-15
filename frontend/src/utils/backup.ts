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
  // CRITICAL: Set flag to prevent server pull from overwriting restored data
  sessionStorage.setItem('tigement_backup_restored', 'true')
  console.log('🛑 Set backup restore flag - will skip server pull on next load')
  
  // CRITICAL: Pause auto-sync for 30 seconds to prevent overwrite
  syncManager.pauseAutoSync(30000)
  console.log('🛑 Auto-sync paused during backup restore')
  
  // Replace all data with backup data
  saveTables(backupData.tables || [])
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
    console.log(`📔 Restored ${Object.keys(backupData.diaries).length} diary entries`)
  }
  
  // Push restored data to server immediately (for premium users)
  try {
    const user = await api.getCurrentUser()
    if (user?.plan === 'premium') {
      console.log('☁️ Pushing restored backup to server...')
      await syncManager.forcePush()
      console.log('✅ Backup pushed to server successfully')
      
      // Also push diary entries to server
      if (backupData.diaries) {
        for (const [date, content] of Object.entries(backupData.diaries)) {
          try {
            await api.saveDiaryEntry(date, content)
          } catch (error) {
            console.error(`⚠️ Failed to push diary entry ${date} to server:`, error)
          }
        }
        console.log(`✅ ${Object.keys(backupData.diaries).length} diary entries pushed to server`)
      }
    }
  } catch (error) {
    console.error('⚠️ Failed to push backup to server:', error)
    // Continue anyway - data is restored locally
  }
}

