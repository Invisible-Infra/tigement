import { Router, Request, Response } from 'express'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import bcrypt from 'bcrypt'
import { query } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

/**
 * Generate 2FA secret and QR code
 * POST /api/2fa/setup
 */
router.post('/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const userEmail = req.user!.email

    // Check if 2FA is already enabled
    const existingResult = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    )

    if (existingResult.rows[0]?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' })
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Tigement (${userEmail})`,
      issuer: 'Tigement'
    })

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!)

    // Store secret (but don't enable yet)
    await query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    )

    res.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    res.status(500).json({ error: 'Failed to set up 2FA' })
  }
})

/**
 * Verify and enable 2FA
 * POST /api/2fa/verify
 * Body: { token: string }
 */
router.post('/verify', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    // Get user's secret
    const result = await query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    )

    const user = result.rows[0]
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: '2FA not set up' })
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps before/after for clock drift
    })

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    // Generate backup codes (10 codes)
    const backupCodes: string[] = []
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      backupCodes.push(code)
      const codeHash = await bcrypt.hash(code, 10)
      await query(
        'INSERT INTO backup_codes (user_id, code_hash) VALUES ($1, $2)',
        [userId, codeHash]
      )
    }

    // Enable 2FA
    await query(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
      [userId]
    )

    res.json({
      success: true,
      backupCodes,
      message: 'Save these backup codes in a safe place. Each can be used once if you lose your authenticator.'
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    res.status(500).json({ error: 'Failed to verify 2FA' })
  }
})

/**
 * Disable 2FA
 * POST /api/2fa/disable
 * Body: { password: string }
 */
router.post('/disable', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }

    // Verify password
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    )

    const user = result.rows[0]
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // Disable 2FA and remove secret
    await query(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1',
      [userId]
    )

    // Delete backup codes
    await query(
      'DELETE FROM backup_codes WHERE user_id = $1',
      [userId]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('2FA disable error:', error)
    res.status(500).json({ error: 'Failed to disable 2FA' })
  }
})

/**
 * Verify 2FA token during login
 * POST /api/2fa/validate
 * Body: { userId: number, token: string }
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.body

    if (!userId || !token) {
      return res.status(400).json({ error: 'User ID and token are required' })
    }

    // Get user's secret
    const result = await query(
      'SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = TRUE',
      [userId]
    )

    const user = result.rows[0]
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: '2FA not enabled for this user' })
    }

    // Check if it's a backup code
    if (token.length === 8 && /^[A-Z0-9]+$/.test(token)) {
      const backupCodesResult = await query(
        'SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used = FALSE',
        [userId]
      )

      for (const backupCode of backupCodesResult.rows) {
        const matches = await bcrypt.compare(token, backupCode.code_hash)
        if (matches) {
          // Mark code as used
          await query(
            'UPDATE backup_codes SET used = TRUE WHERE id = $1',
            [backupCode.id]
          )
          return res.json({ valid: true, usedBackupCode: true })
        }
      }

      return res.status(400).json({ error: 'Invalid backup code' })
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    })

    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    res.json({ valid: true })
  } catch (error) {
    console.error('2FA validate error:', error)
    res.status(500).json({ error: 'Failed to validate 2FA token' })
  }
})

/**
 * Get 2FA status
 * GET /api/2fa/status
 */
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id

    const result = await query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    )

    const user = result.rows[0]
    
    res.json({
      enabled: user?.two_factor_enabled || false
    })
  } catch (error) {
    console.error('2FA status error:', error)
    res.status(500).json({ error: 'Failed to get 2FA status' })
  }
})

export default router

