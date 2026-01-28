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

/**
 * Get debug settings
 * GET /api/announcements/debug-settings
 * Public endpoint - no authentication required
 */
router.get('/debug-settings', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT debug_button_enabled FROM payment_settings WHERE id = 1')
    res.json({ 
      debug_button_enabled: result.rows[0]?.debug_button_enabled || false 
    })
  } catch (error: any) {
    console.error('Error fetching debug settings:', error)
    res.json({ debug_button_enabled: false }) // Fail safe to false
  }
})

export default router

