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

// POST /api/notebooks/workspace - Save workspace notebook
router.post('/workspace', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = saveNotebookSchema.parse(req.body)
    const userId = req.user!.id

    // Upsert workspace notebook
    const result = await query(
      `INSERT INTO notebooks (user_id, notebook_type, content)
       VALUES ($1, 'workspace', $2)
       ON CONFLICT (user_id, notebook_type)
       WHERE notebook_type = 'workspace'
       DO UPDATE SET content = $2, updated_at = NOW()
       RETURNING id`,
      [userId, content]
    )

    res.json({ success: true, id: result.rows[0].id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Save workspace notebook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
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

// POST /api/notebooks/task/:taskId - Save task notebook
router.post('/task/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = saveNotebookSchema.parse(req.body)
    const userId = req.user!.id
    const { taskId } = req.params

    // Upsert task notebook
    const result = await query(
      `INSERT INTO notebooks (user_id, notebook_type, task_id, content)
       VALUES ($1, 'task', $2, $3)
       ON CONFLICT (user_id, task_id)
       WHERE task_id IS NOT NULL
       DO UPDATE SET content = $3, updated_at = NOW()
       RETURNING id`,
      [userId, taskId, content]
    )

    res.json({ success: true, id: result.rows[0].id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Save task notebook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/notebooks/task/:taskId - Delete task notebook
router.delete('/task/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { taskId } = req.params

    await query(
      `DELETE FROM notebooks 
       WHERE user_id = $1 AND notebook_type = 'task' AND task_id = $2`,
      [userId, taskId]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Delete task notebook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

