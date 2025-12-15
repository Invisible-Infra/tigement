/**
 * Manual script to drop plaintext columns after migration
 * 
 * ⚠️ WARNING: This script is DESTRUCTIVE and should only be run manually by an admin
 * ⚠️ ONLY run this after verifying ALL users have migrated their data
 * 
 * Usage: npx ts-node src/scripts/drop-plaintext-columns.ts
 */

import pool, { query } from '../db'

async function checkPlaintextData() {
  console.log('🔍 Checking for remaining plaintext data...\n')

  const results = {
    notebooks: 0,
    diaries: 0,
    archives: 0
  }

  try {
    const notebooksResult = await query(`
      SELECT COUNT(*) as count FROM notebooks 
      WHERE content IS NOT NULL AND content != ''
    `)
    results.notebooks = parseInt(notebooksResult.rows[0].count)
  } catch (error: any) {
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.log('ℹ️  notebooks.content column does not exist (already dropped)')
      results.notebooks = -1
    } else {
      throw error
    }
  }

  try {
    const diariesResult = await query(`
      SELECT COUNT(*) as count FROM diary_entries 
      WHERE content IS NOT NULL AND content != ''
    `)
    results.diaries = parseInt(diariesResult.rows[0].count)
  } catch (error: any) {
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.log('ℹ️  diary_entries.content column does not exist (already dropped)')
      results.diaries = -1
    } else {
      throw error
    }
  }

  try {
    const archivesResult = await query(`
      SELECT COUNT(*) as count FROM archived_tables 
      WHERE table_data IS NOT NULL
    `)
    results.archives = parseInt(archivesResult.rows[0].count)
  } catch (error: any) {
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.log('ℹ️  archived_tables.table_data column does not exist (already dropped)')
      results.archives = -1
    } else {
      throw error
    }
  }

  return results
}

async function dropPlaintextColumns() {
  console.log('🗑️  Dropping Plaintext Columns - Manual Admin Script')
  console.log('=' .repeat(60))
  console.log()

  try {
    const results = await checkPlaintextData()

    const hasPlaintextData = 
      results.notebooks > 0 || 
      results.diaries > 0 || 
      results.archives > 0

    if (hasPlaintextData) {
      console.error('❌ CANNOT DROP COLUMNS - PLAINTEXT DATA STILL EXISTS!\n')
      console.error('Remaining data:')
      if (results.notebooks > 0) console.error(`  - Notebooks: ${results.notebooks} entries`)
      if (results.diaries > 0) console.error(`  - Diaries: ${results.diaries} entries`)
      if (results.archives > 0) console.error(`  - Archives: ${results.archives} entries`)
      console.error()
      console.error('Please ensure all users have migrated their data before dropping columns.')
      console.error('Check the admin migration status endpoint: GET /api/admin/migration-check')
      process.exit(1)
    }

    console.log('✅ No plaintext data found. Safe to drop columns.\n')
    console.log('To drop the columns, run these SQL commands manually:')
    console.log()
    console.log('-- Connect to your database and run:')
    console.log()

    if (results.notebooks !== -1) {
      console.log('ALTER TABLE notebooks DROP COLUMN IF EXISTS content;')
    }
    if (results.diaries !== -1) {
      console.log('ALTER TABLE diary_entries DROP COLUMN IF EXISTS content;')
    }
    if (results.archives !== -1) {
      console.log('ALTER TABLE archived_tables DROP COLUMN IF EXISTS table_data;')
    }

    console.log()
    console.log('-- Also drop unused encrypted_content columns (never used):')
    console.log('ALTER TABLE notebooks DROP COLUMN IF EXISTS encrypted_content;')
    console.log('ALTER TABLE diary_entries DROP COLUMN IF EXISTS encrypted_content;')
    console.log('ALTER TABLE archived_tables DROP COLUMN IF EXISTS encrypted_table_data;')
    console.log()
    console.log('⚠️  Remember to test on a backup first!')
    console.log()

  } catch (error) {
    console.error('❌ Error checking database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the script
dropPlaintextColumns()

