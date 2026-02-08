/**
 * Utility functions for managing archived tables
 */

import { api } from './api'
import { loadArchivedTables, saveArchivedTables } from './storage'

export interface ArchivedTable {
  id: string | number
  table_data?: any
  table_type: 'day' | 'list'
  table_date?: string | null
  table_title: string
  task_count: number
  archived_at: string
}

/**
 * Check if there are archived tables missing table_data
 */
export function hasIncompleteArchives(): boolean {
  const archives = loadArchivedTables() || []
  return archives.some((archive: ArchivedTable) => 
    !archive.table_data && archive.task_count > 0
  )
}

/**
 * Count how many archived tables are missing table_data
 */
export function countIncompleteArchives(): { count: number; totalTasks: number } {
  const archives = loadArchivedTables() || []
  let count = 0
  let totalTasks = 0
  
  archives.forEach((archive: ArchivedTable) => {
    if (!archive.table_data && archive.task_count > 0) {
      count++
      totalTasks += archive.task_count
    }
  })
  
  return { count, totalTasks }
}

/**
 * DEPRECATED: This function has been disabled because it was destructive
 * 
 * The /archives API endpoint only returns metadata (id, title, task_count, etc.)
 * It does NOT return full table_data (individual task details, groups, durations)
 * 
 * Full archived table data is stored in the encrypted workspace blob and synced
 * via syncManager.pull(), not via the /archives endpoint.
 * 
 * Previously, this function mistakenly replaced full local archive data with
 * metadata-only data from the server, resulting in data loss.
 * 
 * @deprecated Do not use - will be removed in future version
 */
export async function fetchAndPopulateArchives(): Promise<{ updated: number; errors: number }> {
  console.error('⛔ fetchAndPopulateArchives is deprecated and disabled')
  console.error('⛔ Full archived table data comes from encrypted workspace, not /archives endpoint')
  console.error('⛔ Use syncManager.pull() to refresh all data including archives')
  
  const localArchives = loadArchivedTables() || []
  const incompleteCount = localArchives.filter(a => !a.table_data).length
  
  return { 
    updated: 0, 
    errors: incompleteCount
  }
}
