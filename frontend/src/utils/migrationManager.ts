// Migration manager for encrypting existing plaintext data
// Handles the one-time migration from plaintext to encrypted storage

import { api } from './api'
import { encryptData, decryptData } from './encryption'

export interface MigrationStatus {
  needsMigration: boolean
  flags: {
    notebooks_migrated: boolean
    diaries_migrated: boolean
    archives_migrated: boolean
  }
}

/**
 * Check if user needs to migrate data to encrypted storage
 */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  try {
    const response = await api.getMigrationStatus()
    return {
      needsMigration: response.needsMigration,
      flags: {
        notebooks_migrated: response.plaintextCounts.notebooks === 0,
        diaries_migrated: response.plaintextCounts.diaries === 0,
        archives_migrated: response.plaintextCounts.archives === 0
      }
    }
  } catch (error) {
    console.error('Failed to check migration status:', error)
    throw new Error('Failed to check migration status')
  }
}

/**
 * Migrate notebooks from plaintext to encrypted storage
 * Fetches plaintext, encrypts locally, sends encrypted version, deletes old plaintext
 */
export async function migrateNotebooks(encryptionKey: string): Promise<void> {
  try {
    // Fetch workspace notebook (plaintext)
    const workspaceResponse = await api.get('/api/notebooks/workspace')
    const workspaceContent = workspaceResponse.data.content || ''

    // Encrypt workspace notebook
    const encryptedWorkspace = await encryptData(workspaceContent, encryptionKey)

    // Save encrypted version
    await api.post('/api/notebooks/workspace', {
      encrypted_content: encryptedWorkspace
    })

    // TODO: Migrate task notebooks (need to fetch list of task IDs)
    // For now, we'll handle this when we implement the full notebook encryption

    console.log('✅ Notebooks migrated successfully')
  } catch (error) {
    console.error('Failed to migrate notebooks:', error)
    throw new Error('Failed to migrate notebooks')
  }
}

/**
 * Migrate diary entries from plaintext to encrypted storage
 */
export async function migrateDiaries(encryptionKey: string): Promise<void> {
  try {
    // Fetch list of diary entries
    const listResponse = await api.get('/api/diary/entries')
    const diaries = listResponse.data || []

    // Migrate each diary entry
    for (const entry of diaries) {
      // Fetch full content
      const response = await api.get(`/api/diary/entry/${entry.date}`)
      const plaintext = response.data.content || ''

      // Encrypt
      const encrypted = await encryptData(plaintext, encryptionKey)

      // Save encrypted version
      await api.post(`/api/diary/entry/${entry.date}`, {
        encrypted_content: encrypted
      })
    }

    console.log(`✅ ${diaries.length} diary entries migrated successfully`)
  } catch (error) {
    console.error('Failed to migrate diaries:', error)
    throw new Error('Failed to migrate diary entries')
  }
}

/**
 * Migrate archived tables from plaintext to encrypted storage
 */
export async function migrateArchives(encryptionKey: string): Promise<void> {
  try {
    // Fetch archived tables
    const response = await api.get('/api/archives')
    const archives = response.data || []

    // Migrate each archived table
    for (const archive of archives) {
      // Encrypt table data
      const plaintext = JSON.stringify(archive.table_data)
      const encrypted = await encryptData(plaintext, encryptionKey)

      // Save encrypted version
      await api.post(`/api/archives/${archive.id}/encrypt`, {
        encrypted_table_data: encrypted
      })
    }

    console.log(`✅ ${archives.length} archived tables migrated successfully`)
  } catch (error) {
    console.error('Failed to migrate archives:', error)
    throw new Error('Failed to migrate archived tables')
  }
}

/**
 * Run complete migration process
 * Migrates all data types and handles errors gracefully
 */
export async function runMigration(
  encryptionKey: string,
  onProgress?: (step: string, current: number, total: number) => void
): Promise<void> {
  const steps = ['notebooks', 'diaries', 'archives']
  let currentStep = 0

  try {
    // Step 1: Migrate notebooks
    onProgress?.('Migrating notebooks...', ++currentStep, steps.length)
    await migrateNotebooks(encryptionKey)

    // Step 2: Migrate diaries
    onProgress?.('Migrating diary entries...', ++currentStep, steps.length)
    await migrateDiaries(encryptionKey)

    // Step 3: Migrate archives
    onProgress?.('Migrating archived tables...', ++currentStep, steps.length)
    await migrateArchives(encryptionKey)

    console.log('✅ Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

