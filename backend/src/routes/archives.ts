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

// POST /api/archives - Archive a table [DEPRECATED]
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Archived tables are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

// POST /api/archives/:id/restore - Restore archived table [DEPRECATED]
router.post('/:id/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Archived tables are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

// DELETE /api/archives/:id - Permanently delete archived table [DEPRECATED]
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Archived tables are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

export default router

