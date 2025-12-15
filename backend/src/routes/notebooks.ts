import { Router, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { query } from '../db'

const router = Router()

// Validation schemas
const saveNotebookSchema = z.object({
  content: z.string()
})

// GET /api/notebooks/workspace - Get workspace notebook
router.get('/workspace', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const result = await query(
      `SELECT content FROM notebooks 
       WHERE user_id = $1 AND notebook_type = 'workspace'`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({ content: '' })
    }

    res.json({ content: result.rows[0].content })
  } catch (error) {
    console.error('Get workspace notebook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notebooks/workspace - Save workspace notebook [DEPRECATED]
router.post('/workspace', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Notebooks are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

// GET /api/notebooks/task/:taskId - Get task notebook
router.get('/task/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { taskId } = req.params

    const result = await query(
      `SELECT content FROM notebooks 
       WHERE user_id = $1 AND notebook_type = 'task' AND task_id = $2`,
      [userId, taskId]
    )

    if (result.rows.length === 0) {
      return res.json({ content: '' })
    }

    res.json({ content: result.rows[0].content })
  } catch (error) {
    console.error('Get task notebook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/notebooks/task/:taskId - Save task notebook [DEPRECATED]
router.post('/task/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Notebooks are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

// DELETE /api/notebooks/task/:taskId - Delete task notebook [DEPRECATED]
router.delete('/task/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated. Notebooks are now synced via encrypted workspace.',
    migrateTo: '/api/workspace',
    message: 'Please update your client to use the unified workspace encryption API.'
  })
})

export default router

