import { Router, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { query } from '../db'

const router = Router()

// Validation schemas
const saveDiaryEntrySchema = z.object({
  content: z.string()
})

// GET /api/diary/entries - List all diary entries
router.get('/entries', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const result = await query(
      `SELECT entry_date, LEFT(content, 50) as preview
       FROM diary_entries 
       WHERE user_id = $1
       ORDER BY entry_date DESC`,
      [userId]
    )

    res.json(result.rows.map(row => ({
      date: row.entry_date,
      preview: row.preview || ''
    })))
  } catch (error) {
    console.error('Get diary entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/diary/entry/:date - Get specific date's full content
router.get('/entry/:date', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    const result = await query(
      `SELECT content FROM diary_entries 
       WHERE user_id = $1 AND entry_date = $2`,
      [userId, date]
    )

    if (result.rows.length === 0) {
      return res.json({ content: '' })
    }

    res.json({ content: result.rows[0].content })
  } catch (error) {
    console.error('Get diary entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/diary/entry/:date - Save/update entry for date
router.post('/entry/:date', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = saveDiaryEntrySchema.parse(req.body)
    const userId = req.user!.id
    const { date } = req.params

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    // Upsert diary entry
    const result = await query(
      `INSERT INTO diary_entries (user_id, entry_date, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, entry_date)
       DO UPDATE SET content = $3, updated_at = NOW()
       RETURNING id`,
      [userId, date, content]
    )

    res.json({ success: true, id: result.rows[0].id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Save diary entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/diary/entry/:date - Delete entry
router.delete('/entry/:date', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { date } = req.params

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    await query(
      `DELETE FROM diary_entries 
       WHERE user_id = $1 AND entry_date = $2`,
      [userId, date]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('Delete diary entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

