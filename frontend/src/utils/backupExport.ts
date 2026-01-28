// Backup export utility for pre-migration safety
// Generates comprehensive JSON backup of all user data

import { api } from './api'

export interface BackupData {
  backup_date: string
  version: string
  user_email: string
  data: {
    tables: any[]
    notebooks: {
      workspace: string
      tasks: Record<string, string>
    }
    diaries: Array<{
      date: string
      content: string
    }>
    archived_tables: any[]
    settings: any
  }
}

/**
 * Generate comprehensive backup of all user data
 * @returns BackupData object ready for download
 */
export async function generateBackup(
  userEmail: string,
  tables: any[],
  notebooks: any,
  settings: any
): Promise<BackupData> {
  try {
    // Fetch diaries from server
    const diaryList = await api.getDiaryEntries()
    
    // Fetch full content for each diary entry
    const diaries = await Promise.all(
      diaryList.map(async (entry: { date: string }) => {
        const response = await api.getDiaryEntry(entry.date)
        return {
          date: entry.date,
          content: response.content || ''
        }
      })
    )

    // Fetch archived tables from server
    const archived_tables = await api.listArchivedTables()

    const backup: BackupData = {
      backup_date: new Date().toISOString(),
      version: 'alpha', // TODO: Get from config
      user_email: userEmail,
      data: {
        tables,
        notebooks: notebooks || { workspace: '', tasks: {} },
        diaries,
        archived_tables,
        settings: settings || {}
      }
    }

    return backup
  } catch (error) {
    console.error('Failed to generate backup:', error)
    throw new Error('Failed to generate backup. Please try again.')
  }
}

/**
 * Download backup as JSON file
 * @param backup BackupData object to download
 */
export function downloadBackup(backup: BackupData) {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `tigement-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate and download backup in one call
 */
export async function exportBackup(
  userEmail: string,
  tables: any[],
  notebooks: any,
  settings: any
): Promise<void> {
  const backup = await generateBackup(userEmail, tables, notebooks, settings)
  downloadBackup(backup)
}

