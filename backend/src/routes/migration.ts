import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { query } from '../db'

const router = Router()

/**
 * GET /api/migration/status
 * Check if user has plaintext data that needs to be migrated to encrypted storage
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    // Check if user has any data in old plaintext columns
    let notebooksCount = 0
    let diariesCount = 0
    let archivesCount = 0

    try {
      const notebooksCheck = await query(
        `SELECT COUNT(*) as count FROM notebooks 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''`,
        [userId]
      )
      notebooksCount = parseInt(notebooksCheck.rows[0].count)
    } catch (error: any) {
      // Column might not exist, that's fine
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    try {
      const diariesCheck = await query(
        `SELECT COUNT(*) as count FROM diary_entries 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''`,
        [userId]
      )
      diariesCount = parseInt(diariesCheck.rows[0].count)
    } catch (error: any) {
      // Column might not exist, that's fine
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    try {
      const archivesCheck = await query(
        `SELECT COUNT(*) as count FROM archived_tables 
         WHERE user_id = $1 
         AND table_data IS NOT NULL 
         AND table_data != '{}'::jsonb`,
        [userId]
      )
      archivesCount = parseInt(archivesCheck.rows[0].count)
    } catch (error: any) {
      // Column might not exist, that's fine
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    const hasPlaintextData = notebooksCount > 0 || diariesCount > 0 || archivesCount > 0

    // Check if user's workspace already contains data
    const workspaceCheck = await query(
      `SELECT encrypted_data FROM workspaces WHERE user_id = $1`,
      [userId]
    )

    res.json({
      needsMigration: hasPlaintextData,
      plaintextCounts: {
        notebooks: notebooksCount,
        diaries: diariesCount,
        archives: archivesCount
      },
      hasWorkspace: workspaceCheck.rows.length > 0
    })
  } catch (error) {
    console.error('Migration status check error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/migration/fetch-plaintext
 * Fetch all plaintext data for migration to encrypted storage
 */
router.get('/fetch-plaintext', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const result: {
      notebooks: Record<string, string>
      diaries: Record<string, string>
      archives: any[]
    } = {
      notebooks: {},
      diaries: {},
      archives: []
    }

    // Fetch notebooks
    try {
      const notebooksResult = await query(
        `SELECT notebook_type, task_id, content 
         FROM notebooks 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''`,
        [userId]
      )
      
      for (const row of notebooksResult.rows) {
        if (row.notebook_type === 'workspace') {
          result.notebooks['workspace'] = row.content
        } else if (row.notebook_type === 'task' && row.task_id) {
          result.notebooks[`task-${row.task_id}`] = row.content
        }
      }
    } catch (error: any) {
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    // Fetch diary entries
    try {
      const diariesResult = await query(
        `SELECT entry_date, content 
         FROM diary_entries 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''`,
        [userId]
      )
      
      for (const row of diariesResult.rows) {
        result.diaries[row.entry_date] = row.content
      }
    } catch (error: any) {
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    // Fetch archived tables
    try {
      const archivesResult = await query(
        `SELECT id, archived_at, table_data 
         FROM archived_tables 
         WHERE user_id = $1 AND table_data IS NOT NULL`,
        [userId]
      )
      
      result.archives = archivesResult.rows.map(row => ({
        id: row.id,
        archived_at: row.archived_at,
        table_data: row.table_data
      }))
    } catch (error: any) {
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    console.log(`📦 Fetched plaintext data for user ${userId}:`, {
      notebooks: Object.keys(result.notebooks).length,
      diaries: Object.keys(result.diaries).length,
      archives: result.archives.length
    })

    res.json(result)
  } catch (error) {
    console.error('Fetch plaintext data error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/migration/delete-plaintext
 * Delete plaintext data after successful migration to encrypted storage
 */
router.post('/delete-plaintext', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    console.log(`🗑️ Starting plaintext deletion for user ${userId}`)

    let notebooksDeleted = 0
    let diariesDeleted = 0
    let archivesDeleted = 0

    // Delete notebooks
    try {
      const result = await query(
        `UPDATE notebooks 
         SET content = '' 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''
         RETURNING id`,
        [userId]
      )
      notebooksDeleted = result.rowCount || 0
      console.log(`  📓 Cleared ${notebooksDeleted} notebook(s)`)
    } catch (error: any) {
      console.log(`  ⚠️ Notebooks table error (might not exist):`, error.message)
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    // Delete diary entries
    try {
      const result = await query(
        `UPDATE diary_entries 
         SET content = '' 
         WHERE user_id = $1 AND content IS NOT NULL AND content != ''
         RETURNING id`,
        [userId]
      )
      diariesDeleted = result.rowCount || 0
      console.log(`  📔 Cleared ${diariesDeleted} diary entry(ies)`)
    } catch (error: any) {
      console.log(`  ⚠️ Diary entries table error (might not exist):`, error.message)
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    // Delete archived tables data
    try {
      const result = await query(
        `UPDATE archived_tables 
         SET table_data = '{}'::jsonb 
         WHERE user_id = $1 AND table_data IS NOT NULL
         RETURNING id`,
        [userId]
      )
      archivesDeleted = result.rowCount || 0
      console.log(`  🗄️ Cleared ${archivesDeleted} archived table(s)`)
    } catch (error: any) {
      console.log(`  ⚠️ Archived tables error (might not exist):`, error.message)
      if (!error.message.includes('column') && !error.message.includes('does not exist')) {
        throw error
      }
    }

    console.log(`✅ Plaintext deletion complete for user ${userId}:`, {
      notebooks: notebooksDeleted,
      diaries: diariesDeleted,
      archives: archivesDeleted
    })

    res.json({ 
      success: true,
      deleted: {
        notebooks: notebooksDeleted,
        diaries: diariesDeleted,
        archives: archivesDeleted
      }
    })
  } catch (error) {
    console.error('❌ Delete plaintext data error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

