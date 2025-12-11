import { Router, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { query } from '../db'

const router = Router()

// Validation schemas
const archiveTableSchema = z.object({
  id: z.string(),
  type: z.enum(['day', 'todo']),
  title: z.string(),
  date: z.string().optional().nullable(),
  startTime: z.string().optional(),
  tasks: z.array(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number()
  })
})

// GET /api/archives - List all archived tables for user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const result = await query(
      `SELECT id, table_type, table_date, table_title, task_count, archived_at 
       FROM archived_tables 
       WHERE user_id = $1 
       ORDER BY archived_at DESC`,
      [userId]
    )

    res.json(result.rows.map(row => ({
      id: row.id,
      table_type: row.table_type,
      table_date: row.table_date,
      table_title: row.table_title,
      task_count: row.task_count,
      archived_at: row.archived_at
    })))
  } catch (error) {
    console.error('List archived tables error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/archives - Archive a table
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tableData = archiveTableSchema.parse(req.body)
    const userId = req.user!.id

    // Extract metadata
    const tableType = tableData.type
    const tableDate = tableData.date || null
    const tableTitle = tableData.title
    const taskCount = tableData.tasks.length

    // Insert archived table
    const result = await query(
      `INSERT INTO archived_tables (user_id, table_data, table_type, table_date, table_title, task_count)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       RETURNING id`,
      [userId, JSON.stringify(tableData), tableType, tableDate, tableTitle, taskCount]
    )

    res.json({ id: result.rows[0].id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Archive table error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/archives/:id/restore - Restore archived table
router.post('/:id/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const archiveId = parseInt(req.params.id)

    if (isNaN(archiveId)) {
      return res.status(400).json({ error: 'Invalid archive ID' })
    }

    // Get archived table
    const result = await query(
      `SELECT table_data FROM archived_tables 
       WHERE id = $1 AND user_id = $2`,
      [archiveId, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archived table not found' })
    }

    const tableData = result.rows[0].table_data

    res.json(tableData)
  } catch (error) {
    console.error('Restore archived table error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/archives/:id - Permanently delete archived table
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const archiveId = parseInt(req.params.id)

    if (isNaN(archiveId)) {
      return res.status(400).json({ error: 'Invalid archive ID' })
    }

    await query(
      `DELETE FROM archived_tables 
       WHERE id = $1 AND user_id = $2`,
      [archiveId, userId]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Delete archived table error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

