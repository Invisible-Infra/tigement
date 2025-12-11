/**
 * Public Announcements Routes
 * Provides public access to active admin announcements
 * No authentication required - visible to all users
 */

import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

/**
 * Get current active announcement
 * GET /api/announcements/current
 * Public endpoint - no authentication required
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT message, text_color, background_color FROM admin_announcements WHERE enabled = true ORDER BY id DESC LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return res.json({ enabled: false })
    }
    
    res.json({ ...result.rows[0], enabled: true })
  } catch (error) {
    console.error('Get announcement error:', error)
    res.status(500).json({ error: 'Failed to get announcement' })
  }
})

export default router

