/**
 * Sync Manager - Handles automatic workspace synchronization
 * Syncs local workspace to backend with encryption for premium users
 */

import { api, VersionConflictError } from './api'
import { encryptWorkspace, decryptWorkspace } from './encryption'
import { encryptionKeyManager } from './encryptionKey'
import { getSyncClientId } from './syncClientId'
import {
  normalizeTableType,
  loadTables,
  saveTables,
  loadSettings,
  saveSettings,
  loadTaskGroups,
  saveTaskGroups,
  loadNotebooks,
  saveNotebooks,
  loadDiaryEntries,
  saveDiaryEntries,
  loadArchivedTables,
  saveArchivedTables,
  getStorageKey,
} from './storage'
import { normalizeDeadline } from './deadline'

interface ConflictData {
  local: { tables: any[]; settings: any; archivedTables?: any[] }
  remote: { tables: any[]; settings: any; archivedTables?: any[] }
}

interface SyncConfig {
  autoSyncInterval: number // milliseconds
  onSyncSuccess?: () => void
  onSyncError?: (error: Error) => void
  onConflict?: (conflict: ConflictData) => Promise<{ resolution: 'local' | 'remote' | 'merge', mergedTables?: any[] }>
  onEmptyDataConfirm?: () => Promise<boolean> // Returns true if user confirms syncing empty data
  isUserEditing?: () => boolean // Returns true if user is actively editing
  onStateUpdate?: (data: { 
    tables: any[]; 
    settings: any; 
    taskGroups?: any[];
    notebooks?: { workspace: string; tasks: Record<string, string> };
    diaries?: Record<string, string>;
    archivedTables?: any[];
  }) => void // Callback to update React state instead of reloading
}

// Deep equality comparison for workspace data
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  
  if (keysA.length !== keysB.length) return false
  if (JSON.stringify(keysA) !== JSON.stringify(keysB)) return false
  
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false
  }
  
  return true
}

// Client-only settings keys that must not affect conflict comparison (e.g. visibility/view mode per device)
const CLIENT_ONLY_SETTINGS_KEYS = ['visibleSpaceIds', 'viewMode']

/** Tables with _shared are local-only; exclude from sync payload */
function tablesForSync(tables: any[]): any[] {
  return (tables || []).filter((t: any) => !t._shared)
}

/** Normalize table types for backward compatibility (todo → list) */
function normalizeRemoteTables(tables: any[]): any[] {
  return (tables || []).map((t: any) => t && typeof t === 'object' ? { ...t, type: normalizeTableType(t.type) } : t)
}

/** Normalize archived table types (table_type and table_data.type) */
function normalizeArchivedTables(archives: any[]): any[] {
  return (archives || []).map((a: any) => {
    if (!a || typeof a !== 'object') return a
    const normalized: any = { ...a, table_type: normalizeTableType(a.table_type) }
    if (a.table_data && typeof a.table_data === 'object') {
      normalized.table_data = { ...a.table_data, type: normalizeTableType(a.table_data.type) }
    }
    return normalized
  })
}

/** Merge remote tables with local shared tables (preserve shared tables when applying remote) */
function mergeSharedTables(remoteTables: any[], localTables: any[]): any[] {
  const shared = (localTables || []).filter((t: any) => t._shared)
  const remoteIds = new Set((remoteTables || []).map((t: any) => t.id))
  const sharedFiltered = shared.filter((t: any) => !remoteIds.has(t.id))
  return [...(remoteTables || []), ...sharedFiltered]
}

// Normalize workspace data for comparison (remove UI-specific fields, trim strings, coerce numbers)
function normalizeWorkspaceData(data: any, excludeShared = false): any {
  if (!data) return null
  
  const rawSettings = data.settings || {}
  const settingsForCompare = { ...rawSettings }
  for (const k of CLIENT_ONLY_SETTINGS_KEYS) {
    delete settingsForCompare[k]
  }
  const tablesToNormalize = excludeShared ? tablesForSync(data.tables || []) : (data.tables || [])

  const normalized = {
    tables: tablesToNormalize.map((table: any) => {
      const t: any = {
        id: table.id,
        type: normalizeTableType(table.type),
        title: (table.title ?? '').toString().trim(),
        date: table.date,
        startTime: (table.startTime ?? '').toString().trim(),
        tasks: (table.tasks || []).map((task: any) => {
          const taskNorm: any = {
            id: task.id,
            title: (task.title ?? '').toString().trim(),
            duration: Number(task.duration) || 0,
            selected: !!task.selected
          }
          if (task.group != null && task.group !== '') taskNorm.group = task.group
          const deadline = normalizeDeadline(task.deadline)
          if (deadline) taskNorm.deadline = deadline
          return taskNorm
        }).sort((a: any, b: any) => a.id.localeCompare(b.id))
      }
      if (table.spaceId != null && table.spaceId !== '') t.spaceId = table.spaceId
      return t
    }).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    settings: settingsForCompare,
    taskGroups: (data.taskGroups || []).sort((a: any, b: any) => a.id.localeCompare(b.id))
  }
  
  return normalized
}

/**
 * True if the only differences between local and remote (normalized) are task titles
 * where remote is empty and local is non-empty (user typed locally; remote had empty from earlier sync).
 */
function isOnlyEmptyRemoteVsNonEmptyLocal(normLocal: any, normRemote: any): boolean {
  if (!normLocal?.tables || !normRemote?.tables) return false
  if (normLocal.tables.length !== normRemote.tables.length) return false
  const localById = new Map((normLocal.tables as any[]).map((t: any) => [t.id, t]))
  const remoteById = new Map((normRemote.tables as any[]).map((t: any) => [t.id, t]))
  for (const [id, localTable] of localById) {
    const remoteTable = remoteById.get(id)
    if (!remoteTable || !localTable.tasks || !remoteTable.tasks) return false
    if (localTable.tasks.length !== remoteTable.tasks.length) return false
    const localTasks = new Map((localTable.tasks as any[]).map((t: any) => [t.id, t]))
    const remoteTasks = new Map((remoteTable.tasks as any[]).map((t: any) => [t.id, t]))
    for (const [tid, localTask] of localTasks) {
      const remoteTask = remoteTasks.get(tid)
      if (!remoteTask) return false
      if (Number(localTask.duration) !== Number(remoteTask.duration)) return false
      if (!!localTask.selected !== !!remoteTask.selected) return false
      if ((localTask.group || '') !== (remoteTask.group || '')) return false
      if ((localTask.deadline || '') !== (remoteTask.deadline || '')) return false
      const rTitle = (remoteTask.title ?? '').toString().trim()
      const lTitle = (localTask.title ?? '').toString().trim()
      if (rTitle === lTitle) continue
      if (rTitle !== '' || lTitle === '') return false
    }
  }
  return true
}

// Custom error class for decryption failures
export class DecryptionFailureError extends Error {
  constructor(
    message: string,
    public readonly encryptedData?: string,
    public readonly reason?: string
  ) {
    super(message)
    this.name = 'DecryptionFailureError'
  }
}

class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null
  private config: SyncConfig
  private localVersion: number = 0
  private isSyncing: boolean = false
  private localModified: boolean = false // Track if local has unsaved changes
  private readonly VERSION_STORAGE_KEY = 'tigement_sync_version'
  private hasDecryptionFailure: boolean = false
  private debounceTimer: NodeJS.Timeout | null = null // For debouncing immediate syncs
  private readonly DEBOUNCE_DELAY = 3000 // 3 seconds debounce for immediate sync after changes
  private decryptionFailureReason: string | null = null
  private forceOverwriteMode: boolean = false // Allow overwrite when user explicitly confirms
  private lastSyncTime: Date | null = null // Track last successful sync time
  private lastSyncDirection: 'uploaded' | 'downloaded' | null = null // Track sync direction
  private focusDetectionSetup: boolean = false // Track if focus detection was setup
  private readonly VISIBLE_SYNC_INTERVAL = 10000 // 10 seconds when tab is visible
  private readonly HIDDEN_SYNC_INTERVAL = 60000 // 60 seconds when tab is hidden
  private clientId: string

  constructor(config: SyncConfig = { autoSyncInterval: 60000 }) { // Default 1 minute
    this.clientId = getSyncClientId()

    // Start with fast polling if tab is visible
    const initialInterval = document.visibilityState === 'visible' 
      ? 10000  // Fast polling when visible
      : 60000  // Slow polling when hidden
    
    this.config = { ...config, autoSyncInterval: initialInterval }
    
    // Load last synced version from localStorage
    const savedVersion = localStorage.getItem(this.VERSION_STORAGE_KEY)
    if (savedVersion) {
      this.localVersion = parseInt(savedVersion, 10)
      console.log('📌 Loaded last sync version from storage:', this.localVersion)
    }
    
    console.log('⚙️ SyncManager initialized with', initialInterval/1000, 'second interval')
  }

  /**
   * Setup window focus/visibility detection for smart polling + instant sync
   * - Triggers immediate sync when tab becomes visible (instant conflict detection)
   * - Adjusts polling interval based on visibility (10s visible, 60s hidden)
   */
  private setupFocusDetection() {
    // Use Page Visibility API - works across all browsers
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab became visible')
        
        // 1. Trigger immediate sync for instant conflict detection (skip when offline)
        if (this.syncInterval) {
          if (!this.isSyncing) {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              console.log('⏸️ Focus sync skipped - offline')
            } else if (!this.config.isUserEditing || !this.config.isUserEditing()) {
              // Clear any pending debounced sync to prevent race conditions
              if (this.debounceTimer) {
                clearTimeout(this.debounceTimer)
                this.debounceTimer = null
                console.log('🔄 Cleared pending debounce timer before focus sync')
              }
              
              console.log('🔄 Focus sync triggered')
              this.sync().catch(error => {
                console.error('Focus sync failed:', error)
                this.config.onSyncError?.(error)
              })
            } else {
              console.log('⏸️ Focus sync skipped - user is actively editing')
            }
          } else {
            console.log('⏸️ Focus sync skipped - sync already in progress')
          }
        }
        
        // 2. Switch to fast polling (10s) when visible
        if (this.syncInterval && this.config.autoSyncInterval !== this.VISIBLE_SYNC_INTERVAL) {
          console.log('⚡ Switching to fast polling (10s) - tab is visible')
          this.config.autoSyncInterval = this.VISIBLE_SYNC_INTERVAL
          this.restartAutoSync()
        }
      } else {
        // Tab hidden - switch to slow polling (60s) to save battery
        console.log('👁️ Tab hidden')
        if (this.syncInterval && this.config.autoSyncInterval !== this.HIDDEN_SYNC_INTERVAL) {
          console.log('🐌 Switching to slow polling (60s) - tab is hidden')
          this.config.autoSyncInterval = this.HIDDEN_SYNC_INTERVAL
          this.restartAutoSync()
        }
      }
    })
    
    console.log('👁️ Smart polling + focus detection enabled')
  }

  /**
   * Restart auto-sync with current interval (used when switching polling speed)
   */
  private restartAutoSync() {
    if (!this.syncInterval) return
    
    clearInterval(this.syncInterval)
    
    this.syncInterval = setInterval(() => {
      if (this.isSyncing) {
        console.log('⏸️ Periodic sync skipped: sync already in progress')
        return
      }
      
      if (this.config.isUserEditing && this.config.isUserEditing()) {
        console.log('⏸️ Auto-sync skipped: user is actively editing')
        return
      }
      
      console.log('⏰ Periodic sync triggered')
      this.sync().catch(error => {
        console.error('Auto-sync failed:', error)
        this.config.onSyncError?.(error)
      })
    }, this.config.autoSyncInterval)
  }

  /**
   * Set encryption key (from login password)
   * Stored in sessionStorage, NOT sent to server
   */
  setEncryptionKey(key: string) {
    encryptionKeyManager.setKey(key)
    console.log('🔑 Encryption key set for E2EE sync')
  }

  /**
   * Set custom encryption key (for advanced users)
   * Allows using a different key than login password
   */
  setCustomEncryptionKey(customKey: string) {
    encryptionKeyManager.setCustomKey(customKey)
    console.log('🔑 Custom encryption key set')
  }

  /**
   * Get current encryption key
   */
  private getEncryptionKey(): string | null {
    return encryptionKeyManager.getKey()
  }

  /**
   * Public method to check if encryption key is set (for debugging)
   */
  hasEncryptionKey(): boolean {
    return !!encryptionKeyManager.getKey()
  }

  /**
   * Clear encryption key (on logout)
   */
  clearEncryptionKey() {
    encryptionKeyManager.clearKey()
    this.clearDecryptionFailure()
    console.log('🔑 Encryption key cleared')
  }

  /**
   * Set decryption failure state
   */
  setDecryptionFailure(reason: string) {
    this.hasDecryptionFailure = true
    this.decryptionFailureReason = reason
    console.error('❌ Decryption failure set:', reason)
  }

  /**
   * Clear decryption failure state
   */
  clearDecryptionFailure() {
    this.hasDecryptionFailure = false
    this.decryptionFailureReason = null
    this.forceOverwriteMode = false
    console.log('✅ Decryption failure cleared')
  }

  /**
   * Get decryption failure state
   */
  getDecryptionFailure(): { hasFailure: boolean; reason: string | null } {
    return {
      hasFailure: this.hasDecryptionFailure,
      reason: this.decryptionFailureReason
    }
  }

  /**
   * Get last sync time and direction
   */
  getLastSyncInfo(): { time: Date | null; direction: 'uploaded' | 'downloaded' | null } {
    return {
      time: this.lastSyncTime,
      direction: this.lastSyncDirection
    }
  }

  /**
   * Check if sync operation is currently in progress
   */
  public get syncInProgress(): boolean {
    return this.isSyncing
  }

  /**
   * Get last sync time (deprecated, use getLastSyncInfo)
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime
  }

  /**
   * Enable force overwrite mode (user explicitly confirmed)
   */
  enableForceOverwrite() {
    this.forceOverwriteMode = true
    this.clearDecryptionFailure()
    console.log('⚠️ Force overwrite mode enabled')
  }

  /**
   * Retry sync after fixing encryption key
   */
  async retrySync(): Promise<void> {
    this.clearDecryptionFailure()
    return this.sync()
  }

  /**
   * Force overwrite server data (user confirmed data loss)
   */
  async forceOverwrite(): Promise<void> {
    this.enableForceOverwrite()
    return this.sync()
  }

  /**
   * @deprecated Use setEncryptionKey instead
   */
  setPassword(password: string) {
    this.setEncryptionKey(password)
  }

  /**
   * Mark local data as modified (has unsaved changes)
   * Called by UI when user makes changes
   * Triggers a debounced sync after a short delay
   */
  markLocalModified() {
    this.localModified = true

    // Don't schedule sync if not authenticated or auto-sync is not running
    if (!this.syncInterval) {
      console.log('⏸️ Sync not scheduled - auto-sync not active (user not authenticated)')
      return
    }
    
    // Don't reschedule if timer already running (prevents duplicate schedules)
    if (this.debounceTimer) {
      console.log('⏱️ Debounce timer already active, extending wait period')
      clearTimeout(this.debounceTimer)
    }
    
    // Schedule sync after debounce delay
    this.debounceTimer = setTimeout(() => {
      console.log('🔄 Debounced sync triggered after local change')
      this.sync().catch(err => {
        console.error('❌ Debounced sync failed:', err)
        this.config.onSyncError?.(err)
      })
    }, this.DEBOUNCE_DELAY)
    
    console.log(`⏱️ Sync scheduled in ${this.DEBOUNCE_DELAY}ms`)
  }

  /**
   * Update and persist local version
   */
  private updateLocalVersion(version: number) {
    this.localVersion = version
    localStorage.setItem(this.VERSION_STORAGE_KEY, version.toString())
    console.log('💾 Saved sync version to storage:', version)
  }

  /**
   * Set conflict resolution callback
   */
  setConflictHandler(handler: (conflict: ConflictData) => Promise<{ resolution: 'local' | 'remote' | 'merge', mergedTables?: any[] }>) {
    this.config.onConflict = handler
    console.log('🔀 Conflict handler registered')
  }

  /**
   * Set empty data confirmation callback
   */
  setEmptyDataConfirmHandler(handler: () => Promise<boolean>) {
    this.config.onEmptyDataConfirm = handler
    console.log('⚠️ Empty data confirmation handler registered')
  }

  /**
   * Set user editing detection callback
   */
  setIsUserEditing(handler: () => boolean) {
    this.config.isUserEditing = handler
    console.log('✏️ User editing detection handler registered')
  }

  /**
   * Set state update callback (replaces page reloads)
   */
  setOnStateUpdate(handler: (data: { tables: any[]; settings: any; taskGroups?: any[] }) => void) {
    this.config.onStateUpdate = handler
    console.log('🔄 State update handler registered')
  }

  /**
   * Check if workspace data is empty (no tables or no meaningful content)
   */
  private isWorkspaceEmpty(data: any): boolean {
    if (!data || !data.tables || !Array.isArray(data.tables)) {
      return true
    }

    // Empty array is considered empty
    if (data.tables.length === 0) {
      return true
    }

    // Check if all tables have no tasks with meaningful content
    const hasContent = data.tables.some((table: any) => {
      if (!table.tasks || !Array.isArray(table.tasks)) {
        return false
      }
      // A table has content if it has at least one task with a non-empty title
      return table.tasks.some((task: any) => 
        task && task.title && typeof task.title === 'string' && task.title.trim().length > 0
      )
    })

    return !hasContent
  }

  /**
   * Start automatic sync
   */
  startAutoSync(config?: Partial<SyncConfig>) {
    // Merge provided config with existing config
    if (config) {
      this.config = { ...this.config, ...config }
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    console.log('🔄 Starting auto-sync with interval:', this.config.autoSyncInterval)

    // Setup focus detection on first auto-sync start (only once)
    if (!this.focusDetectionSetup) {
      this.setupFocusDetection()
      this.focusDetectionSetup = true
    }

    this.syncInterval = setInterval(() => {
      // Skip if sync already in progress
      if (this.isSyncing) {
        console.log('⏸️ Periodic sync skipped: sync already in progress')
        return
      }
      
      // Skip sync if user is actively editing
      if (this.config.isUserEditing && this.config.isUserEditing()) {
        console.log('⏸️ Auto-sync skipped: user is actively editing')
        return
      }
      
      console.log('⏰ Periodic sync triggered')
      this.sync().catch(error => {
        console.error('Auto-sync failed:', error)
        this.config.onSyncError?.(error)
      })
    }, this.config.autoSyncInterval)

    console.log('🔄 Auto-sync started')
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('⏸️ Auto-sync stopped')
    }
    
    // Also clear any pending debounced sync
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
      console.log('⏸️ Debounced sync cancelled')
    }
  }

  /**
   * Temporarily pause auto-sync (e.g., during backup restore)
   */
  pauseAutoSync(durationMs: number = 10000) {
    console.log(`⏸️ Pausing auto-sync for ${durationMs}ms`)
    this.stopAutoSync()
    
    setTimeout(() => {
      console.log('▶️ Resuming auto-sync after pause')
      this.startAutoSync()
    }, durationMs)
  }

  private readonly VERSION_CONFLICT_MAX_RETRIES = 5
  private readonly VERSION_CONFLICT_RETRY_DELAY_MS = 200
  private readonly VERSION_CONFLICT_RETRY_DELAY_JITTER_MS = 200

  /**
   * Manually trigger sync
   */
  async sync(isRetry: boolean = false, retryCount: number = 0): Promise<void> {
    console.log(isRetry ? `🔄 Retrying sync operation (attempt ${retryCount + 1}/${this.VERSION_CONFLICT_MAX_RETRIES + 1})...` : '🔄 Starting sync operation...')
    
    if (this.isSyncing) {
      console.log('⏭️ Sync already in progress, skipping')
      return
    }

    // Block sync if decryption failure is active (unless force overwrite mode)
    if (this.hasDecryptionFailure && !this.forceOverwriteMode) {
      const reason = this.decryptionFailureReason || 'Cannot decrypt server data'
      throw new DecryptionFailureError(
        `Cannot sync: ${reason}. Please enter your custom encryption key or force overwrite.`,
        undefined,
        reason
      )
    }

    const encryptionKey = this.getEncryptionKey()
    if (!encryptionKey) {
      console.error('❌ No encryption key set, cannot sync')
      throw new Error('Encryption key not set for sync. Please login again.')
    }

    this.isSyncing = true
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tigement:sync-start'))
    }

    let syncSucceeded = false
    // Re-read local version from storage so we pick up updates from applyRemoteWorkspace or other tabs
    const savedVersion = localStorage.getItem(this.VERSION_STORAGE_KEY)
    if (savedVersion !== null) {
      const v = parseInt(savedVersion, 10)
      if (!isNaN(v) && v !== this.localVersion) {
        this.localVersion = v
        console.log('📌 Refreshed local version from storage:', this.localVersion)
      }
    }

    // Clear any pending debounce timer to prevent race conditions
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
      console.log('🔄 Cleared pending debounce timer')
    }

    let encryptedData: string | null = null
    let isRetrying = false
    try {
      // Allow Workspace to flush its current state to localStorage before we read
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tigement:sync-will-start'))
      }
      // Get local workspace data (always fresh from localStorage)
      console.log('📂 Getting local workspace data...')
      const localData = this.getLocalWorkspace()
      if (!localData) {
        console.warn('⚠️ No local workspace data to sync')
        this.isSyncing = false
        return
      }
      console.log('📊 Local data:', { tablesCount: localData.tables?.length })

      // Check if local data is empty (no tables or all tables have no meaningful content)
      const isEmptyData = this.isWorkspaceEmpty(localData)
      let confirmedEmptySync = false
      
      // Check remote version first (needed for both empty check and conflict detection)
      console.log('🌐 Checking remote version...')
      const remoteVersion = await api.getWorkspaceVersion()
      const remoteLastClientId = (remoteVersion as any).lastClientId ?? null
      console.log('📌 Remote version:', remoteVersion.version, 'Local version:', this.localVersion, 'Last client:', remoteLastClientId)
      
      if (isEmptyData) {
        console.warn('⚠️ Local workspace data is empty (no tables or no meaningful content)')
        
        // Check if there's remote data that would be overwritten
        const hasRemoteData = remoteVersion.version > 0
        
        if (hasRemoteData) {
          // If remote has data, require user confirmation before overwriting with empty data
          if (this.config.onEmptyDataConfirm) {
            const confirmed = await this.config.onEmptyDataConfirm()
            if (!confirmed) {
              console.log('❌ User cancelled sync of empty data')
              this.isSyncing = false
              throw new Error('Sync cancelled: You chose not to sync empty data that would overwrite server data.')
            }
            confirmedEmptySync = true
            console.log('✅ User confirmed empty data sync - will overwrite server data')
          } else {
            // No handler, default to blocking empty sync if remote has data
            console.error('❌ Cannot sync empty data: remote has data and no confirmation handler')
            this.isSyncing = false
            throw new Error('Cannot sync empty data: This would overwrite existing server data. Please add tables or pull from server first.')
          }
        }
        // If no remote data, allow empty sync (first sync scenario)
      }

      // Encrypt data (exclude shared tables - they are local-only)
      console.log('🔒 Encrypting workspace data...')
      const dataForSync = { ...localData, tables: tablesForSync(localData.tables || []) }
      encryptedData = await encryptWorkspace(dataForSync, encryptionKey)
      console.log('✅ Data encrypted successfully')

      console.log('📊 Has local changes:', this.localModified)

      // If user confirmed empty sync, skip conflict detection and overwrite
      if (confirmedEmptySync) {
        console.log('⚠️ User confirmed empty sync - overwriting server data without conflict check')
        const targetVersion = remoteVersion.version + 1
        const response = await api.saveWorkspace(encryptedData, targetVersion)
        // Only update local version after successful push
        this.updateLocalVersion(targetVersion)
        console.log('✅ Empty data sync completed (server data overwritten)')
        this.localModified = false
        syncSucceeded = true
        this.config.onSyncSuccess?.()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
        }
        return
      }

      // Determine if we need to check for conflicts
      const remoteIsNewer = remoteVersion.version > this.localVersion
      const hasLocalChanges = this.localModified
      const sameSource = remoteLastClientId != null && remoteLastClientId === this.clientId

      if (remoteIsNewer && hasLocalChanges) {
        console.log('🔍 Potential conflict detected, fetching remote data for comparison...')
        
        // Fetch remote data for comparison
        const remoteWorkspace = await api.getWorkspace()
        if (!remoteWorkspace || !remoteWorkspace.data) {
          // The server reported a newer non-zero version. Treat a missing
          // encrypted snapshot as inconsistent state, never as a blank remote
          // workspace that can safely be overwritten.
          throw new Error('Remote workspace is unavailable: refusing to overwrite newer data.')
        }

        let remoteData
        try {
          remoteData = await decryptWorkspace(remoteWorkspace.data, encryptionKey)
        } catch (decryptError) {
          console.error('❌ Failed to decrypt remote data:', decryptError)
          
          // If force overwrite mode is enabled, proceed with overwrite
          if (this.forceOverwriteMode) {
            console.log('⚠️ Force overwrite mode: overwriting server data')
            const targetVersion = remoteVersion.version + 1
            const response = await api.saveWorkspace(encryptedData, targetVersion)
            // Only update local version after successful push
            this.updateLocalVersion(targetVersion)
            console.log('✅ Forced local push completed')
            this.localModified = false
            syncSucceeded = true
            this.config.onSyncSuccess?.()
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
            }
            return
          }
          
          // Otherwise, set decryption failure and throw error
          const reason = 'Wrong encryption key - cannot decrypt server data'
          this.setDecryptionFailure(reason)
          throw new DecryptionFailureError(
            'Cannot decrypt server data. The encryption key does not match. Please enter your custom encryption key or force overwrite (will lose server data).',
            remoteWorkspace.data,
            reason
          )
        }
        
        // Normalize both datasets for comparison (removes UI-specific fields; exclude shared tables from local)
        const normalizedLocal = normalizeWorkspaceData(localData, true)
        const normalizedRemote = normalizeWorkspaceData(remoteData)
        
        console.log('🔍 Comparing normalized data...')
        console.log('📊 Local normalized:', JSON.stringify(normalizedLocal, null, 2))
        console.log('📊 Remote normalized:', JSON.stringify(normalizedRemote, null, 2))
        
        // Check if data is actually different
        const isEqual = deepEqual(normalizedLocal, normalizedRemote)
        console.log('🎯 Deep equality result:', isEqual)
        
        if (isEqual) {
          if (!hasLocalChanges || sameSource) {
            console.log('✅ Data is identical (normalized) and safe to pull remote to stay in sync')
            // Data is essentially the same, but pull remote to ensure perfect sync
            // This handles cases where only UI fields (position) differ
            await this.applyRemoteWorkspace(remoteWorkspace)
            this.localModified = false
            syncSucceeded = true
            this.config.onSyncSuccess?.()
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
            }
            return
          } else {
            console.log('⚠️ Normalized data equal but localModified indicates newer edits – skipping auto-pull')
          }
        }

        // Auto-resolve: only diff is "remote task title empty, local non-empty" (user typed; remote had empty)
        if (isOnlyEmptyRemoteVsNonEmptyLocal(normalizedLocal, normalizedRemote)) {
          console.log('✅ Auto-resolve: only empty remote vs non-empty local task titles - pushing local')
          const targetVersion = remoteVersion.version + 1
          await api.saveWorkspace(encryptedData, targetVersion)
          this.updateLocalVersion(targetVersion)
          this.localModified = false
          this.lastSyncTime = new Date()
          this.lastSyncDirection = 'uploaded'
          syncSucceeded = true
          this.config.onSyncSuccess?.()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
          }
          return
        }
        
        // REAL CONFLICT: Data is actually different
        console.warn('⚠️ REAL CONFLICT: Remote and local data differ')
        console.log('⚠️ Remote version:', remoteVersion.version, '> Local version:', this.localVersion)

        // Divergent remote and local data always require explicit resolution,
        // even when the last server write bears the same client ID.
        if (this.config.onConflict) {
          console.log('🤔 Asking user to resolve conflict...')
          const conflictData: ConflictData = {
            local: {
              tables: localData.tables || [],
              settings: localData.settings || {},
              archivedTables: localData.archivedTables || []
            },
            remote: {
              tables: remoteData.tables || [],
              settings: remoteData.settings || {},
              archivedTables: remoteData.archivedTables || []
            }
          }
          
          const resolution = await this.config.onConflict(conflictData)
          
          if (resolution.resolution === 'local') {
            // User chose local, push it
            console.log('✅ User chose local, pushing...')
            const targetVersion = remoteVersion.version + 1
            await api.saveWorkspace(encryptedData, targetVersion)
            // Only update local version after successful push
            this.updateLocalVersion(targetVersion)
            this.localModified = false
            syncSucceeded = true
            this.config.onSyncSuccess?.()
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
            }
          } else if (resolution.resolution === 'remote') {
            // User chose remote, pull it
            console.log('✅ User chose remote, pulling...')
            await this.applyRemoteWorkspace(remoteWorkspace)
            this.localModified = false
            syncSucceeded = true
            this.config.onSyncSuccess?.()
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
            }
          } else if (resolution.resolution === 'merge' && resolution.mergedTables) {
            // User manually merged (exclude shared tables from sync payload)
            console.log('✅ User merged, pushing merged result...')
            const mergedData = {
              tables: tablesForSync(resolution.mergedTables),
              settings: localData.settings,
              taskGroups: localData.taskGroups || []
            }
            const mergedEncrypted = await encryptWorkspace(mergedData, encryptionKey)
            const targetVersion = remoteVersion.version + 1
            await api.saveWorkspace(mergedEncrypted, targetVersion)
            // Only update local version after successful push
            this.updateLocalVersion(targetVersion)
            // Restore shared tables in localStorage (mergedData excludes them for sync)
            const localTables = loadTables() || []
            const tablesToSave = mergeSharedTables(mergedData.tables, localTables)
            saveTables(tablesToSave)
            saveSettings(mergedData.settings)
            if (mergedData.taskGroups) {
              saveTaskGroups(mergedData.taskGroups)
            }
            
            // Update React state via callback instead of reloading
            if (this.config.onStateUpdate) {
              console.log('🔄 Updating React state via callback...')
              this.config.onStateUpdate({ ...mergedData, tables: tablesToSave })
            } else {
              // Fallback to reload if no callback provided (backward compatibility)
              console.log('⚠️ No state update callback, falling back to reload...')
              window.location.reload()
            }
            
            this.localModified = false
            syncSucceeded = true
            this.config.onSyncSuccess?.()
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
            }
          }
        } else {
          // No conflict handler, default to pulling remote (safe)
          console.log('⚠️ No conflict handler, pulling remote (safe)')
          await this.pull()
          syncSucceeded = true
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
          }
        }
      } else if (remoteIsNewer) {
        // Remote is newer, but we have NO local changes - just pull
        console.log('⬇️ Remote is newer, pulling (no local changes to conflict)...')
        await this.pull()
        this.localModified = false
        syncSucceeded = true
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
        }
      } else {
        // Versions match - only push if we have local changes
        if (hasLocalChanges) {
          const targetVersion = remoteVersion.version + 1
          console.log('⬆️ Pushing local changes (remote:', remoteVersion.version, '→', targetVersion, ')')
          console.log('📤 Attempting push to version:', targetVersion)
          const response = await api.saveWorkspace(encryptedData, targetVersion, this.clientId)
          // Only update local version after successful push
          this.updateLocalVersion(targetVersion)
          console.log('✅ Push completed!')
          this.localModified = false
          this.lastSyncTime = new Date()
          this.lastSyncDirection = 'uploaded'
          syncSucceeded = true
          this.config.onSyncSuccess?.()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
          }
        } else {
          // No changes and versions match - nothing to sync
          console.log('✅ Already in sync (no local changes, versions match)')
          this.localModified = false
          this.lastSyncTime = new Date()
          this.lastSyncDirection = 'uploaded'
          syncSucceeded = true
          this.config.onSyncSuccess?.()
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: true } }))
          }
        }
      }
    } catch (error: any) {
      const isVersionConflict = error.message?.includes('Version conflict') || error instanceof VersionConflictError
      const willRetry = isVersionConflict && retryCount < this.VERSION_CONFLICT_MAX_RETRIES

      if (willRetry) {
        console.warn('⚠️ Version conflict, retrying...', error.message)
      } else {
        console.error('❌ Sync failed:', error)
        console.error('Error details:', error.message, (error as any).response?.data)
      }

      // Full retry: delay and retry with fresh remote version
      const stillVersionConflict = error.message?.includes('Version conflict') || error instanceof VersionConflictError
      if (stillVersionConflict && retryCount < this.VERSION_CONFLICT_MAX_RETRIES) {
        const delay = this.VERSION_CONFLICT_RETRY_DELAY_MS + Math.random() * this.VERSION_CONFLICT_RETRY_DELAY_JITTER_MS
        console.log(`🔄 Version conflict detected, retrying with fresh remote version (retry ${retryCount + 1}/${this.VERSION_CONFLICT_MAX_RETRIES}) in ${Math.round(delay)}ms`)
        await new Promise(r => setTimeout(r, delay))
        this.isSyncing = false // Release so retry can pass the guard
        isRetrying = true
        return this.sync(true, retryCount + 1)
      }

      // Check if this is an auth error - stop auto-sync to prevent repeated failures
      if (error.message?.includes('Authentication failed') || 
          error.message?.includes('Session expired')) {
        console.error('🛑 Stopping auto-sync due to auth failure')
        this.stopAutoSync()
      }
      
      this.config.onSyncError?.(error)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tigement:sync-complete', { detail: { success: false } }))
      }
      throw error
    } finally {
      if (!isRetrying) {
        this.isSyncing = false
      }
    }
  }

  /**
   * Apply remote workspace data to local storage
   */
  private async applyRemoteWorkspace(remoteWorkspace: any): Promise<void> {
    const encryptionKey = this.getEncryptionKey()
    if (!encryptionKey) {
      throw new Error('Encryption key not set')
    }

    console.log('📥 Applying remote workspace data...')
    const decryptedData = await decryptWorkspace(remoteWorkspace.data, encryptionKey)
    const localTables = loadTables() || []
    const tablesToSave = mergeSharedTables(normalizeRemoteTables(decryptedData.tables || []), localTables)
    // Save to local storage (merge remote with local shared tables)
    saveTables(tablesToSave)
    // Preserve client-only settings (e.g. visibleSpaceIds) when applying remote
    const currentSettings = loadSettings() || {}
    const mergedSettings = { ...(decryptedData.settings || {}) }
    for (const k of CLIENT_ONLY_SETTINGS_KEYS) {
      if (currentSettings[k] !== undefined && currentSettings[k] !== null) {
        mergedSettings[k] = currentSettings[k]
      }
    }
    saveSettings(mergedSettings)
    if (decryptedData.taskGroups) {
      saveTaskGroups(decryptedData.taskGroups)
    }
    if (decryptedData.notebooks) {
      saveNotebooks(decryptedData.notebooks)
      console.log('📓 Restored notebooks from workspace')
    }
    if (decryptedData.diaries) {
      saveDiaryEntries(decryptedData.diaries)
      console.log('📔 Restored', Object.keys(decryptedData.diaries).length, 'diary entries from workspace')
    }
    let normalizedArchives: any[] = []
    if (decryptedData.archivedTables) {
      normalizedArchives = normalizeArchivedTables(decryptedData.archivedTables)
      saveArchivedTables(normalizedArchives)
      console.log('🗄️ Restored', normalizedArchives.length, 'archived tables from workspace')
    }
    
    this.updateLocalVersion(remoteWorkspace.version)
    this.localModified = false  // Explicitly clear after pull
    console.log('✅ Remote data applied')
    
    // Update React state via callback instead of reloading
    if (this.config.onStateUpdate) {
      console.log('🔄 Updating React state via callback...')
      this.config.onStateUpdate({
        tables: tablesToSave,
        settings: decryptedData.settings || {},
        taskGroups: decryptedData.taskGroups || [],
        notebooks: decryptedData.notebooks || { workspace: '', tasks: {} },
        diaries: decryptedData.diaries || {},
        archivedTables: normalizedArchives
      })
    } else {
      // Fallback to reload if no callback provided (backward compatibility)
      console.log('⚠️ No state update callback, falling back to reload...')
      window.location.reload()
    }
  }

  /**
   * Pull remote workspace and merge with local
   */
  async pull(): Promise<void> {
    console.log('📥 Starting pull operation...')
    
    const encryptionKey = this.getEncryptionKey()
    if (!encryptionKey) {
      console.error('❌ Encryption key not set for sync')
      throw new Error('Encryption key not set. Please login again.')
    }

    console.log('🌐 Fetching remote workspace...')
    const remote = await api.getWorkspace()
    console.log('📦 Remote workspace response:', remote)
    
    if (!remote.data) {
      console.log('⏭️ No remote data to pull (user has no synced data yet)')
      return
    }

    console.log('🔓 Decrypting workspace data...')
    // Decrypt remote data
    let decryptedData
    try {
      decryptedData = await decryptWorkspace(remote.data, encryptionKey)
      console.log('✅ Decrypted data:', { 
        tablesCount: decryptedData.tables?.length,
        hasSettings: !!decryptedData.settings 
      })
    } catch (decryptError) {
      console.error('❌ Failed to decrypt workspace data:', decryptError)
      
      // Set decryption failure state
      const reason = 'Wrong encryption key - cannot decrypt server data'
      this.setDecryptionFailure(reason)
      
      throw new DecryptionFailureError(
        'Cannot decrypt server data. The encryption key does not match. Please enter your custom encryption key or force overwrite (will lose server data).',
        remote.data,
        reason
      )
    }

    // Save to local storage (merge remote with local shared tables)
    console.log('💾 Saving to localStorage...')
    const localTables = loadTables() || []
    const tablesToSave = mergeSharedTables(normalizeRemoteTables(decryptedData.tables || []), localTables)
    saveTables(tablesToSave)
    // Preserve client-only settings (e.g. visibleSpaceIds) when applying remote
    const currentSettings = loadSettings() || {}
    const mergedSettings = { ...(decryptedData.settings || {}) }
    for (const k of CLIENT_ONLY_SETTINGS_KEYS) {
      if (currentSettings[k] !== undefined && currentSettings[k] !== null) {
        mergedSettings[k] = currentSettings[k]
      }
    }
    saveSettings(mergedSettings)
    
    // Handle AI config sync
    if (decryptedData.aiConfig) {
      console.log('🤖 Syncing AI config from server')
      localStorage.setItem(getStorageKey('tigement_ai_config'), decryptedData.aiConfig)
    } else {
      console.log('🤖 No AI config in remote data (backward compatibility)')
    }
    
    // Handle taskGroups carefully:
    // - If server has taskGroups, use them (even if empty, but warn)
    // - If server data doesn't have taskGroups property at all, keep local ones
    if ('taskGroups' in decryptedData) {
      if (decryptedData.taskGroups && decryptedData.taskGroups.length > 0) {
        saveTaskGroups(decryptedData.taskGroups)
      } else {
        // Server has empty taskGroups - this might be data corruption
        console.warn('⚠️ Server has empty taskGroups - this may indicate data loss. Keeping local taskGroups if they exist.')
        const localGroups = loadTaskGroups()
        if (!localGroups || localGroups.length === 0) {
          // Both server and local are empty - remove the key to trigger default fallback
          localStorage.removeItem(getStorageKey('tigement_task_groups'))
        }
        // Otherwise keep local ones
      }
    }
    
    // Save notebooks, diaries, and archived tables
    if (decryptedData.notebooks) {
      saveNotebooks(decryptedData.notebooks)
      console.log('📓 Restored notebooks from workspace')
    }
    if (decryptedData.diaries) {
      saveDiaryEntries(decryptedData.diaries)
      console.log('📔 Restored', Object.keys(decryptedData.diaries).length, 'diary entries from workspace')
    }
    let normalizedArchives: any[] = []
    if (decryptedData.archivedTables) {
      normalizedArchives = normalizeArchivedTables(decryptedData.archivedTables)
      saveArchivedTables(normalizedArchives)
      console.log('🗄️ Restored', normalizedArchives.length, 'archived tables from workspace')
    }

    this.updateLocalVersion(remote.version)

    console.log('✅ Pull completed successfully')
    this.lastSyncTime = new Date()
    this.lastSyncDirection = 'downloaded'
    this.config.onSyncSuccess?.()

    // Update React state via callback instead of reloading
    if (this.config.onStateUpdate) {
      console.log('🔄 Updating React state via callback...')
      this.config.onStateUpdate({
        tables: tablesToSave,
        settings: decryptedData.settings || {},
        taskGroups: decryptedData.taskGroups || [],
        notebooks: decryptedData.notebooks || { workspace: '', tasks: {} },
        diaries: decryptedData.diaries || {},
        archivedTables: normalizedArchives
      })
    } else {
      // Fallback to reload if no callback provided (backward compatibility)
      console.log('⚠️ No state update callback, falling back to reload...')
      window.location.reload()
    }
  }

  /**
   * Get local workspace data
   */
  private getLocalWorkspace(): any | null {
    console.log('🔍 Checking localStorage for workspace data...')
    const tables = loadTables()
    const settings = loadSettings()
    const taskGroups = loadTaskGroups()
    const notebooks = loadNotebooks()
    const diaries = loadDiaryEntries()
    const archives = loadArchivedTables()
    const aiConfig = typeof localStorage !== 'undefined' ? localStorage.getItem(getStorageKey('tigement_ai_config')) : null
    console.log('📦 localStorage.tigement_tables:', tables ? `${JSON.stringify(tables).length} chars` : 'NULL')
    console.log('⚙️ localStorage.tigement_settings:', settings ? `${JSON.stringify(settings).length} chars` : 'NULL')
    console.log('📁 localStorage.tigement_task_groups:', taskGroups ? `${JSON.stringify(taskGroups).length} chars` : 'NULL')
    console.log('📓 localStorage.tigement_notebooks:', notebooks ? `${JSON.stringify(notebooks).length} chars` : 'NULL')
    console.log('📔 localStorage.tigement_diary_entries:', diaries ? `${JSON.stringify(diaries).length} chars` : 'NULL')
    console.log('🗄️ localStorage.tigement_archived_tables:', archives ? `${JSON.stringify(archives).length} chars` : 'NULL')
    console.log('🤖 localStorage.tigement_ai_config:', aiConfig ? `${aiConfig.length} chars` : 'NULL')

    if (!tables) {
      console.error('❌ No tables found in localStorage!')
      return null
    }

    const parsed = {
      tables,
      settings: settings || {},
      taskGroups: taskGroups || [],
      notebooks: notebooks || { workspace: '', tasks: {} },
      diaries: diaries || {},
      archivedTables: archives === null ? undefined : archives,
      aiConfig: aiConfig || null // AI config is already encrypted, store as-is
    }
    const archivedCount = Array.isArray(parsed.archivedTables) ? parsed.archivedTables.length : 0
    console.log('✅ Parsed workspace data:', parsed.tables.length, 'tables', parsed.taskGroups?.length || 0, 'task groups', Object.keys(parsed.diaries).length, 'diary entries', archivedCount, 'archived tables', parsed.aiConfig ? 'AI config present' : 'no AI config')
    return parsed
  }

  /**
   * Force push local data (overwrites remote)
   */
  async forcePush(): Promise<void> {
    const encryptionKey = this.getEncryptionKey()
    if (!encryptionKey) {
      throw new Error('Encryption key not set')
    }

    const localData = this.getLocalWorkspace()
    if (!localData) {
      throw new Error('No local data to push')
    }
    const dataForSync = { ...localData, tables: tablesForSync(localData.tables || []) }

    const encryptedData = await encryptWorkspace(dataForSync, encryptionKey)
    
    this.localVersion++
    await api.saveWorkspace(encryptedData, this.localVersion)

    this.lastSyncTime = new Date()
    this.lastSyncDirection = 'uploaded'
    console.log('✅ Force push completed')
  }

  /**
   * Check sync status
   */
  getStatus(): { syncing: boolean; version: number; hasPassword: boolean } {
    return {
      syncing: this.isSyncing,
      version: this.localVersion,
      hasPassword: this.hasEncryptionKey()
    }
  }
}

// Singleton instance
export const syncManager = new SyncManager()

