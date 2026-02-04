/**
 * OAuth Routes
 * Handles OAuth authentication flows and encryption passphrase setup
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import pool, { query } from '../db';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Track recently used OAuth authorization codes to avoid double-processing callbacks
const usedOAuthCodes = new Map<string, number>();
const OAUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function markCodeUsed(code: string) {
  const now = Date.now();
  usedOAuthCodes.set(code, now);

  // Clean up old codes
  for (const [c, ts] of usedOAuthCodes.entries()) {
    if (now - ts > OAUTH_CODE_TTL_MS) {
      usedOAuthCodes.delete(c);
    }
  }
}

function isCodeUsed(code: string): boolean {
  const ts = usedOAuthCodes.get(code);
  if (!ts) return false;
  if (Date.now() - ts > OAUTH_CODE_TTL_MS) {
    usedOAuthCodes.delete(code);
    return false;
  }
  return true;
}

/**
 * Get available OAuth providers
 * GET /api/auth/oauth/providers
 */
router.get('/oauth/providers', (req: Request, res: Response) => {
  const providers = {
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID),
    twitter: !!(process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET),
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
  };

  res.json({ providers });
});

/**
 * Initiate OAuth login for a provider
 * GET /api/auth/oauth/:provider
 */
router.get('/oauth/:provider', (req: Request, res: Response, next) => {
  const provider = req.params.provider;
  
  // Validate provider
  const validProviders = ['github', 'google', 'apple', 'twitter', 'facebook'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: 'Invalid OAuth provider' });
  }

  // Set appropriate scope for each provider
  let scope: string[];
  switch (provider) {
    case 'github':
      scope = ['user:email'];
      break;
    case 'google':
      scope = ['profile', 'email'];
      break;
    case 'apple':
      scope = ['name', 'email'];
      break;
    case 'twitter':
      scope = [];
      break;
    case 'facebook':
      scope = ['email', 'public_profile'];
      break;
    default:
      scope = ['email'];
  }

  passport.authenticate(provider, { scope, session: false })(req, res, next);
});

/**
 * OAuth callback handler
 * GET /api/auth/oauth/:provider/callback
 */
router.get('/oauth/:provider/callback', (req: Request, res: Response, next) => {
  const provider = req.params.provider;
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;

  console.log('OAuth callback hit', { provider, code, url: req.originalUrl });

  if (code && isCodeUsed(code)) {
    console.warn(`⚠️ Duplicate OAuth callback ignored for ${provider} (code already used)`);
    return res.redirect(`${FRONTEND_URL}/?oauth_error=oauth_code_reused`);
  }

  passport.authenticate(provider, { session: false }, async (err: any, user: any) => {
    if (err) {
      console.error(`OAuth error for ${provider}:`, err);
      return res.redirect(`${FRONTEND_URL}/?oauth_error=auth_failed`);
    }

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/?oauth_error=no_user`);
    }

    if (code) {
      markCodeUsed(code);
    }

    try {
      // Check if user has encryption passphrase set
      const hasPassphrase = user.encryption_passphrase_hash !== null && user.encryption_passphrase_hash !== undefined;
      
      console.log(`OAuth callback successful for user ${user.id}, has passphrase: ${hasPassphrase}`);

      // Generate temporary OAuth token (short-lived for passphrase setup)
      const secret = process.env.JWT_SECRET!;
      const oauthToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          oauth_temp: true, 
          has_passphrase: hasPassphrase 
        },
        secret,
        { expiresIn: '5m' }
      );

      // Redirect to frontend with token
      res.redirect(`${FRONTEND_URL}/?oauth_token=${oauthToken}`);
    } catch (error) {
      console.error('OAuth callback processing error:', error);
      res.redirect(`${FRONTEND_URL}/?oauth_error=processing_failed`);
    }
  })(req, res, next);
});

/**
 * Set or verify encryption passphrase after OAuth
 * POST /api/auth/oauth/passphrase
 */
const passphraseSchema = z.object({
  oauthToken: z.string(),
  passphrase: z.string().min(8),
  isNew: z.boolean()
});

router.post('/oauth/passphrase', async (req: Request, res: Response) => {
  try {
    const { oauthToken, passphrase, isNew } = passphraseSchema.parse(req.body);

    const secret = process.env.JWT_SECRET!;
    const refreshSecret = process.env.JWT_REFRESH_SECRET!;

    // Verify OAuth token
    let decoded: any;
    try {
      decoded = jwt.verify(oauthToken, secret) as any;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired OAuth token' });
    }
    
    if (!decoded.oauth_temp) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    // Fetch user with subscription info
    const userResult = await query(
      `SELECT u.*, s.plan, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    if (isNew) {
      // Set new passphrase
      if (user.encryption_passphrase_hash) {
        return res.status(400).json({ error: 'Passphrase already set. Use isNew: false to verify.' });
      }
      
      const passphraseHash = await bcrypt.hash(passphrase, 10);
      await query(
        'UPDATE users SET encryption_passphrase_hash = $1 WHERE id = $2',
        [passphraseHash, user.id]
      );
      console.log(`Set new encryption passphrase for user ${user.id}`);
    } else {
      // Verify existing passphrase
      if (!user.encryption_passphrase_hash) {
        return res.status(400).json({ error: 'No passphrase set. Use isNew: true to create one.' });
      }
      
      const valid = await bcrypt.compare(passphrase, user.encryption_passphrase_hash);
      if (!valid) {
        return res.status(400).json({ error: 'Invalid passphrase' });
      }
      console.log(`Verified encryption passphrase for user ${user.id}`);
    }

    // Check premium expiration
    if (user.plan === 'premium' && user.expires_at) {
      const settingsResult = await query(
        'SELECT premium_grace_period_days FROM payment_settings WHERE id = 1'
      );
      const gracePeriodDays = settingsResult.rows[0]?.premium_grace_period_days || 3;
      
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      const gracePeriodEnd = new Date(expiresAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
      
      if (now > gracePeriodEnd) {
        await query('UPDATE subscriptions SET status = $1 WHERE user_id = $2', ['expired', user.id]);
        user.subscription_status = 'expired';
      } else if (now > expiresAt && now <= gracePeriodEnd) {
        user.subscription_status = 'active';
        user.in_grace_period = true;
      }
    }

    // Generate real tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn: '2h' }
    );
    
    const refreshToken = jwt.sign(
      { id: user.id },
      refreshSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
        username: user.username,
        profile_picture_url: user.profile_picture_url,
        plan: user.plan,
        subscription_status: user.subscription_status,
        started_at: user.started_at,
        expires_at: user.expires_at,
        in_grace_period: user.in_grace_period || false
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Passphrase setup error:', error);
    res.status(500).json({ error: 'Failed to process passphrase' });
  }
});

/**
 * Reset encryption passphrase (deletes all encrypted data)
 * POST /api/auth/oauth/reset-passphrase
 */
const resetPassphraseSchema = z.object({
  oauthToken: z.string()
});

router.post('/oauth/reset-passphrase', async (req: Request, res: Response) => {
  try {
    const { oauthToken } = resetPassphraseSchema.parse(req.body);

    const secret = process.env.JWT_SECRET!;

    // Verify OAuth token
    let decoded: any;
    try {
      decoded = jwt.verify(oauthToken, secret) as any;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired OAuth token' });
    }
    
    if (!decoded.oauth_temp) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const userId = decoded.id;

    console.log(`🗑️ Resetting encryption passphrase for user ${userId} - all encrypted data will be deleted`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE users SET encryption_passphrase_hash = NULL WHERE id = $1',
        [userId]
      );
      await client.query(
        'DELETE FROM workspaces WHERE user_id = $1',
        [userId]
      );
      await client.query('COMMIT');
      console.log(`  ✅ Cleared passphrase hash for user ${userId}`);
      console.log(`  ✅ Deleted encrypted workspace for user ${userId}`);
      console.log(`✅ Passphrase reset complete for user ${userId}`);
      res.json({ success: true });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Passphrase reset error:', error);
    res.status(500).json({ error: 'Failed to reset passphrase' });
  }
});

export default router;

