/**
 * Sync Manager - Handles automatic workspace synchronization
 * Syncs local workspace to backend with encryption for premium users
 */

import { api } from './api'
import { encryptWorkspace, decryptWorkspace } from './encryption'
import { encryptionKeyManager } from './encryptionKey'

interface ConflictData {
  local: { tables: any[]; settings: any }
  remote: { tables: any[]; settings: any }
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

// Normalize workspace data for comparison (remove UI-specific fields like position)
function normalizeWorkspaceData(data: any): any {
  if (!data) return null
  
  const normalized = {
    tables: (data.tables || []).map((table: any) => ({
      id: table.id,
      type: table.type,
      title: table.title,
      date: table.date,
      startTime: table.startTime,
      spaceId: table.spaceId, // Include space assignment
      tasks: (table.tasks || []).map((task: any) => ({
        id: task.id,
        title: task.title, // Fixed: was 'name', should be 'title'
        duration: task.duration,
        selected: task.selected || false,
        group: task.group // Include task group assignments
      })).sort((a: any, b: any) => a.id.localeCompare(b.id)) // Sort for consistent comparison
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)), // Sort tables too
    settings: data.settings || {},
    taskGroups: (data.taskGroups || []).sort((a: any, b: any) => a.id.localeCompare(b.id)) // Include taskGroups for sync
  }
  
  return normalized
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

  constructor(config: SyncConfig = { autoSyncInterval: 60000 }) { // Default 1 minute
    this.config = config
    // Load last synced version from localStorage
    const savedVersion = localStorage.getItem(this.VERSION_STORAGE_KEY)
    if (savedVersion) {
      this.localVersion = parseInt(savedVersion, 10)
      console.log('📌 Loaded last sync version from storage:', this.localVersion)
    }
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
    
    // Clear existing debounce timer
    if (this.debounceTimer) {
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

    this.syncInterval = setInterval(() => {
      // Skip sync if user is actively editing
      if (this.config.isUserEditing && this.config.isUserEditing()) {
        console.log('⏸️ Auto-sync skipped: user is actively editing')
        return
      }
      
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

  /**
   * Manually trigger sync
   */
  async sync(): Promise<void> {
    console.log('🔄 Starting sync operation...')
    
    if (this.isSyncing) {
      console.log('⏭️ Sync already in progress, skipping')
      return
    }

    // Skip sync if user is actively editing (unless forced)
    if (this.config.isUserEditing && this.config.isUserEditing()) {
      console.log('⏸️ Sync skipped: user is actively editing')
      throw new Error('Cannot sync while user is actively editing. Please finish editing and try again.')
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

    try {
      // Get local workspace data
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
      console.log('📌 Remote version:', remoteVersion.version, 'Local version:', this.localVersion)
      
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

      // Encrypt data
      console.log('🔒 Encrypting workspace data...')
      const encryptedData = await encryptWorkspace(localData, encryptionKey)
      console.log('✅ Data encrypted successfully')

      console.log('📊 Has local changes:', this.localModified)

      // If user confirmed empty sync, skip conflict detection and overwrite
      if (confirmedEmptySync) {
        console.log('⚠️ User confirmed empty sync - overwriting server data without conflict check')
        this.updateLocalVersion(remoteVersion.version + 1)
        const response = await api.saveWorkspace(encryptedData, this.localVersion)
        console.log('✅ Empty data sync completed (server data overwritten)')
        this.localModified = false
        this.config.onSyncSuccess?.()
        this.isSyncing = false
        return
      }

      // Determine if we need to check for conflicts
      const remoteIsNewer = remoteVersion.version > this.localVersion
      const hasLocalChanges = this.localModified || localData !== null

      if (remoteIsNewer && hasLocalChanges) {
        console.log('🔍 Potential conflict detected, fetching remote data for comparison...')
        
        // Fetch remote data for comparison
        const remoteWorkspace = await api.getWorkspace()
        if (!remoteWorkspace || !remoteWorkspace.data) {
          console.log('⚠️ No remote data found, safe to push')
          // No remote data yet, safe to push our local changes
          this.updateLocalVersion(remoteVersion.version + 1)
          const response = await api.saveWorkspace(encryptedData, this.localVersion)
          console.log('✅ First sync completed, data saved to cloud!')
          this.localModified = false
          this.config.onSyncSuccess?.()
          return
        }

        let remoteData
        try {
          remoteData = await decryptWorkspace(remoteWorkspace.data, encryptionKey)
        } catch (decryptError) {
          console.error('❌ Failed to decrypt remote data:', decryptError)
          
          // If force overwrite mode is enabled, proceed with overwrite
          if (this.forceOverwriteMode) {
            console.log('⚠️ Force overwrite mode: overwriting server data')
            this.updateLocalVersion(remoteVersion.version + 1)
            const response = await api.saveWorkspace(encryptedData, this.localVersion)
            console.log('✅ Forced local push completed')
            this.localModified = false
            this.config.onSyncSuccess?.()
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
        
        // Normalize both datasets for comparison (removes UI-specific fields)
        const normalizedLocal = normalizeWorkspaceData(localData)
        const normalizedRemote = normalizeWorkspaceData(remoteData)
        
        console.log('🔍 Comparing normalized data...')
        console.log('📊 Local normalized:', JSON.stringify(normalizedLocal, null, 2))
        console.log('📊 Remote normalized:', JSON.stringify(normalizedRemote, null, 2))
        
        // Check if data is actually different
        const isEqual = deepEqual(normalizedLocal, normalizedRemote)
        console.log('🎯 Deep equality result:', isEqual)
        
        if (isEqual) {
          console.log('✅ Data is identical (normalized) - pulling remote to stay in sync')
          // Data is essentially the same, but pull remote to ensure perfect sync
          // This handles cases where only UI fields (position) differ
          await this.applyRemoteWorkspace(remoteWorkspace)
          this.localModified = false
          this.config.onSyncSuccess?.()
          return
        }
        
        // REAL CONFLICT: Data is actually different
        console.warn('⚠️ REAL CONFLICT: Remote and local data differ')
        console.log('⚠️ Remote version:', remoteVersion.version, '> Local version:', this.localVersion)
        
        // Show conflict dialog to user
        if (this.config.onConflict) {
          console.log('🤔 Asking user to resolve conflict...')
          const conflictData: ConflictData = {
            local: localData,
            remote: remoteData
          }
          
          const resolution = await this.config.onConflict(conflictData)
          
          if (resolution.resolution === 'local') {
            // User chose local, push it
            console.log('✅ User chose local, pushing...')
            this.updateLocalVersion(remoteVersion.version + 1)
            await api.saveWorkspace(encryptedData, this.localVersion)
            this.localModified = false
            this.config.onSyncSuccess?.()
          } else if (resolution.resolution === 'remote') {
            // User chose remote, pull it
            console.log('✅ User chose remote, pulling...')
            await this.applyRemoteWorkspace(remoteWorkspace)
            this.localModified = false
            this.config.onSyncSuccess?.()
          } else if (resolution.resolution === 'merge' && resolution.mergedTables) {
            // User manually merged
            console.log('✅ User merged, pushing merged result...')
            const mergedData = {
              tables: resolution.mergedTables,
              settings: localData.settings,
              taskGroups: localData.taskGroups || []
            }
            const mergedEncrypted = await encryptWorkspace(mergedData, encryptionKey)
            this.updateLocalVersion(remoteVersion.version + 1)
            await api.saveWorkspace(mergedEncrypted, this.localVersion)
            
            localStorage.setItem('tigement_tables', JSON.stringify(mergedData.tables))
            localStorage.setItem('tigement_settings', JSON.stringify(mergedData.settings))
            if (mergedData.taskGroups) {
              localStorage.setItem('tigement_task_groups', JSON.stringify(mergedData.taskGroups))
            }
            
            // Update React state via callback instead of reloading
            if (this.config.onStateUpdate) {
              console.log('🔄 Updating React state via callback...')
              this.config.onStateUpdate(mergedData)
            } else {
              // Fallback to reload if no callback provided (backward compatibility)
              console.log('⚠️ No state update callback, falling back to reload...')
              window.location.reload()
            }
            
            this.localModified = false
            this.config.onSyncSuccess?.()
          }
        } else {
          // No conflict handler, default to pulling remote (safe)
          console.log('⚠️ No conflict handler, pulling remote (safe)')
          await this.pull()
        }
      } else if (remoteIsNewer) {
        // Remote is newer, but we have NO local changes - just pull
        console.log('⬇️ Remote is newer, pulling (no local changes to conflict)...')
        await this.pull()
        this.localModified = false
      } else {
        // Safe to push: remote version matches our last sync
        console.log('⬆️ Pushing local changes (remote:', remoteVersion.version, '→', remoteVersion.version + 1, ')')
        this.updateLocalVersion(remoteVersion.version + 1)
        const response = await api.saveWorkspace(encryptedData, this.localVersion)
        console.log('✅ Push completed!')
        this.localModified = false
        this.lastSyncTime = new Date()
        this.lastSyncDirection = 'uploaded'
        this.config.onSyncSuccess?.()
      }
    } catch (error: any) {
      console.error('❌ Sync failed:', error)
      console.error('Error details:', error.message, error.response?.data)
      
      // Check if this is an auth error - stop auto-sync to prevent repeated failures
      if (error.message?.includes('Authentication failed') || 
          error.message?.includes('Session expired')) {
        console.error('🛑 Stopping auto-sync due to auth failure')
        this.stopAutoSync()
      }
      
      this.config.onSyncError?.(error)
      throw error
    } finally {
      this.isSyncing = false
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
    
    // Save to local storage
    localStorage.setItem('tigement_tables', JSON.stringify(decryptedData.tables || []))
    localStorage.setItem('tigement_settings', JSON.stringify(decryptedData.settings || {}))
    if (decryptedData.taskGroups) {
      localStorage.setItem('tigement_task_groups', JSON.stringify(decryptedData.taskGroups))
    }
    if (decryptedData.notebooks) {
      localStorage.setItem('tigement_notebooks', JSON.stringify(decryptedData.notebooks))
      console.log('📓 Restored notebooks from workspace')
    }
    if (decryptedData.diaries) {
      localStorage.setItem('tigement_diary_entries', JSON.stringify(decryptedData.diaries))
      console.log('📔 Restored', Object.keys(decryptedData.diaries).length, 'diary entries from workspace')
    }
    if (decryptedData.archivedTables) {
      localStorage.setItem('tigement_archived_tables', JSON.stringify(decryptedData.archivedTables))
      console.log('🗄️ Restored', decryptedData.archivedTables.length, 'archived tables from workspace')
    }
    
    this.updateLocalVersion(remoteWorkspace.version)
    console.log('✅ Remote data applied')
    
    // Update React state via callback instead of reloading
    if (this.config.onStateUpdate) {
      console.log('🔄 Updating React state via callback...')
      this.config.onStateUpdate({
        tables: decryptedData.tables || [],
        settings: decryptedData.settings || {},
        taskGroups: decryptedData.taskGroups || [],
        notebooks: decryptedData.notebooks || { workspace: '', tasks: {} },
        diaries: decryptedData.diaries || {},
        archivedTables: decryptedData.archivedTables || []
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

    // Save to local storage
    console.log('💾 Saving to localStorage...')
    localStorage.setItem('tigement_tables', JSON.stringify(decryptedData.tables || []))
    localStorage.setItem('tigement_settings', JSON.stringify(decryptedData.settings || {}))
    
    // Handle taskGroups carefully:
    // - If server has taskGroups, use them (even if empty, but warn)
    // - If server data doesn't have taskGroups property at all, keep local ones
    if ('taskGroups' in decryptedData) {
      if (decryptedData.taskGroups && decryptedData.taskGroups.length > 0) {
        localStorage.setItem('tigement_task_groups', JSON.stringify(decryptedData.taskGroups))
      } else {
        // Server has empty taskGroups - this might be data corruption
        console.warn('⚠️ Server has empty taskGroups - this may indicate data loss. Keeping local taskGroups if they exist.')
        const localGroups = localStorage.getItem('tigement_task_groups')
        if (!localGroups || localGroups === '[]') {
          // Both server and local are empty - remove the key to trigger default fallback
          localStorage.removeItem('tigement_task_groups')
        }
        // Otherwise keep local ones
      }
    }
    
    // Save notebooks, diaries, and archived tables
    if (decryptedData.notebooks) {
      localStorage.setItem('tigement_notebooks', JSON.stringify(decryptedData.notebooks))
      console.log('📓 Restored notebooks from workspace')
    }
    if (decryptedData.diaries) {
      localStorage.setItem('tigement_diary_entries', JSON.stringify(decryptedData.diaries))
      console.log('📔 Restored', Object.keys(decryptedData.diaries).length, 'diary entries from workspace')
    }
    if (decryptedData.archivedTables) {
      localStorage.setItem('tigement_archived_tables', JSON.stringify(decryptedData.archivedTables))
      console.log('🗄️ Restored', decryptedData.archivedTables.length, 'archived tables from workspace')
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
        tables: decryptedData.tables || [],
        settings: decryptedData.settings || {},
        taskGroups: decryptedData.taskGroups || [],
        notebooks: decryptedData.notebooks || { workspace: '', tasks: {} },
        diaries: decryptedData.diaries || {},
        archivedTables: decryptedData.archivedTables || []
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
    const tables = localStorage.getItem('tigement_tables')
    const settings = localStorage.getItem('tigement_settings')
    const taskGroups = localStorage.getItem('tigement_task_groups')
    const notebooks = localStorage.getItem('tigement_notebooks')
    const diaries = localStorage.getItem('tigement_diary_entries')
    const archives = localStorage.getItem('tigement_archived_tables')
    console.log('📦 localStorage.tigement_tables:', tables ? `${tables.length} chars` : 'NULL')
    console.log('⚙️ localStorage.tigement_settings:', settings ? `${settings.length} chars` : 'NULL')
    console.log('📁 localStorage.tigement_task_groups:', taskGroups ? `${taskGroups.length} chars` : 'NULL')
    console.log('📓 localStorage.tigement_notebooks:', notebooks ? `${notebooks.length} chars` : 'NULL')
    console.log('📔 localStorage.tigement_diary_entries:', diaries ? `${diaries.length} chars` : 'NULL')
    console.log('🗄️ localStorage.tigement_archived_tables:', archives ? `${archives.length} chars` : 'NULL')

    if (!tables) {
      console.error('❌ No tables found in localStorage!')
      return null
    }

    const parsed = {
      tables: JSON.parse(tables),
      settings: settings ? JSON.parse(settings) : {},
      taskGroups: taskGroups ? JSON.parse(taskGroups) : [],
      notebooks: notebooks ? JSON.parse(notebooks) : { workspace: '', tasks: {} },
      diaries: diaries ? JSON.parse(diaries) : {},
      archivedTables: archives ? JSON.parse(archives) : []
    }
    console.log('✅ Parsed workspace data:', parsed.tables.length, 'tables', parsed.taskGroups?.length || 0, 'task groups', Object.keys(parsed.diaries).length, 'diary entries', parsed.archivedTables.length, 'archived tables')
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

    const encryptedData = await encryptWorkspace(localData, encryptionKey)
    
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

