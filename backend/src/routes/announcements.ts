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
 * Returns the single latest row by id; only shown if that row has enabled = true (so disabling hides it).
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, message, text_color, background_color, enabled FROM admin_announcements ORDER BY id DESC LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return res.json({ enabled: false })
    }
    
    const row = result.rows[0]
    if (!row.enabled) {
      return res.json({ enabled: false })
    }
    
    res.json({ id: row.id, message: row.message, text_color: row.text_color, background_color: row.background_color, enabled: true })
  } catch (error) {
    console.error('Get announcement error:', error)
    res.status(500).json({ error: 'Failed to get announcement' })
  }
})

/**
 * Get onboarding video URL
 * GET /api/announcements/onboarding-video-url
 * Public endpoint - no authentication required
 */
router.get('/onboarding-video-url', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT onboarding_video_url FROM payment_settings WHERE id = 1')
    const url = result.rows[0]?.onboarding_video_url || ''
    res.json({ url: url || '' })
  } catch (error: any) {
    console.error('Error fetching onboarding video URL:', error)
    res.json({ url: '' })
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

