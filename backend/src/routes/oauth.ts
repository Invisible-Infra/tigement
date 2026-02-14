/**
 * OAuth Routes
 * Handles OAuth authentication flows and encryption passphrase setup
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import pool, { query } from '../db';
import { getJwtSecret, getJwtRefreshSecret } from '../env';
import { getAndDeleteProviderToken } from '../oauthProviderTokenCache';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Track recently used OAuth authorization codes to avoid double-processing callbacks
// Map from authorization code -> { token: string, ts: number }
const usedOAuthCodes = new Map<string, { token: string; ts: number }>();
const OAUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanupUsedOAuthCodes() {
  const now = Date.now();
  for (const [code, entry] of usedOAuthCodes.entries()) {
    if (now - entry.ts > OAUTH_CODE_TTL_MS) {
      usedOAuthCodes.delete(code);
    }
  }
}

function setCodeToken(code: string, token: string) {
  usedOAuthCodes.set(code, { token, ts: Date.now() });
  cleanupUsedOAuthCodes();
}

function getCodeToken(code: string): string | null {
  const entry = usedOAuthCodes.get(code);
  if (!entry) return null;
  if (Date.now() - entry.ts > OAUTH_CODE_TTL_MS) {
    usedOAuthCodes.delete(code);
    return null;
  }
  return entry.token;
}

/**
 * Get available OAuth providers
 * GET /api/auth/oauth/providers
 */
router.get('/oauth/providers', (req: Request, res: Response) => {
  const providers = {
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY_PATH),
    twitter: !!(process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET),
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
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
  const validProviders = ['github', 'google', 'apple', 'twitter', 'facebook', 'microsoft'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: 'Invalid OAuth provider' });
  }

  // Set appropriate scope (include Drive/gist/OneDrive for provider-stored sync key where supported)
  let scope: string[];
  switch (provider) {
    case 'github':
      scope = ['user:email', 'gist'];
      break;
    case 'google':
      scope = ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'];
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
    case 'microsoft':
      scope = ['user.read', 'Files.ReadWrite.AppFolder'];
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

  if (code) {
    const existingToken = getCodeToken(code);
    if (existingToken) {
      console.warn(`⚠️ Duplicate OAuth callback for ${provider} (code already used) – reusing cached token`);
      return res.redirect(`${FRONTEND_URL}/?oauth_token=${existingToken}`);
    }
  }

  passport.authenticate(provider, { session: false }, async (err: any, user: any) => {
    if (err) {
      console.error(`OAuth error for ${provider}:`, err);
      return res.redirect(`${FRONTEND_URL}/?oauth_error=auth_failed`);
    }

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/?oauth_error=no_user`);
    }

    try {
      const hasPassphraseHash = user.encryption_passphrase_hash != null;
      const hasProviderKey = user.encryption_key_in_provider === true;
      const hasPassphrase = hasPassphraseHash || hasProviderKey;

      console.log(`OAuth callback successful for user ${user.id}, has_passphrase: ${hasPassphrase}, has_provider_key: ${hasProviderKey}`);

      // Generate temporary OAuth token (short-lived for passphrase setup or provider-key flow)
      const secret = getJwtSecret();
      const oauthToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          oauth_temp: true,
          has_passphrase: hasPassphrase,
          has_provider_key: hasProviderKey,
          provider: user.oauth_provider || undefined
        },
        secret,
        { expiresIn: '5m' }
      );

      if (code) {
        setCodeToken(code, oauthToken);
      }

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

    const secret = getJwtSecret();
    const refreshSecret = getJwtRefreshSecret();

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

    // Store refresh token hash (never store plaintext)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenLookupHash = crypto.createHash('sha256').update(refreshToken, 'utf8').digest('hex');
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, token_lookup_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, tokenHash, tokenLookupHash, expiresAt]
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

    const secret = getJwtSecret();

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
        'UPDATE users SET encryption_passphrase_hash = NULL, encryption_key_in_provider = false WHERE id = $1',
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

/**
 * Verify encryption passphrase only (for migration to provider-stored key).
 * Does not issue tokens; frontend then uploads passphrase to provider and calls complete-with-provider-key.
 * POST /api/auth/oauth/verify-passphrase
 */
const verifyPassphraseSchema = z.object({
  oauthToken: z.string(),
  passphrase: z.string().min(8)
});

router.post('/oauth/verify-passphrase', async (req: Request, res: Response) => {
  try {
    const { oauthToken, passphrase } = verifyPassphraseSchema.parse(req.body);

    const secret = getJwtSecret();
    let decoded: any;
    try {
      decoded = jwt.verify(oauthToken, secret) as any;
    } catch {
      return res.status(400).json({ error: 'Invalid or expired OAuth token' });
    }
    if (!decoded.oauth_temp || !decoded.id) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const userResult = await query('SELECT encryption_passphrase_hash FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    if (!user.encryption_passphrase_hash) {
      return res.status(400).json({ error: 'No passphrase set' });
    }
    const valid = await bcrypt.compare(passphrase, user.encryption_passphrase_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid passphrase' });
    }
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Verify passphrase error:', error);
    res.status(500).json({ error: 'Failed to verify passphrase' });
  }
});

/**
 * Exchange short-lived oauth_token for provider access token (one-time).
 * Frontend uses it to read/write sync key in Google Drive / GitHub gist / OneDrive.
 * POST /api/auth/oauth/provider-token
 */
const providerTokenSchema = z.object({
  oauthToken: z.string()
});

router.post('/oauth/provider-token', async (req: Request, res: Response) => {
  try {
    const { oauthToken } = providerTokenSchema.parse(req.body);

    const secret = getJwtSecret();
    let decoded: any;
    try {
      decoded = jwt.verify(oauthToken, secret) as any;
    } catch {
      return res.status(400).json({ error: 'Invalid or expired OAuth token' });
    }
    if (!decoded.oauth_temp || !decoded.id) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    const payload = getAndDeleteProviderToken(decoded.id);
    if (!payload) {
      return res.status(404).json({ error: 'Provider token not found or already used' });
    }
    if (!['google', 'github', 'microsoft'].includes(payload.provider)) {
      return res.status(400).json({ error: 'Provider does not support key storage' });
    }

    res.json({ provider: payload.provider, accessToken: payload.accessToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Provider token error:', error);
    res.status(500).json({ error: 'Failed to get provider token' });
  }
});

/**
 * Complete OAuth login with provider-stored key (no passphrase).
 * Marks user as encryption_key_in_provider and issues access/refresh tokens.
 * POST /api/auth/oauth/complete-with-provider-key
 */
const completeProviderKeySchema = z.object({
  oauthToken: z.string()
});

router.post('/oauth/complete-with-provider-key', async (req: Request, res: Response) => {
  try {
    const { oauthToken } = completeProviderKeySchema.parse(req.body);

    const secret = getJwtSecret();
    const refreshSecret = getJwtRefreshSecret();
    let decoded: any;
    try {
      decoded = jwt.verify(oauthToken, secret) as any;
    } catch {
      return res.status(400).json({ error: 'Invalid or expired OAuth token' });
    }
    if (!decoded.oauth_temp || !decoded.id) {
      return res.status(400).json({ error: 'Invalid token type' });
    }

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

    await query(
      'UPDATE users SET encryption_key_in_provider = true, encryption_passphrase_hash = NULL WHERE id = $1',
      [user.id]
    );
    user.encryption_key_in_provider = true;
    user.encryption_passphrase_hash = null;

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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const tokenLookupHash = crypto.createHash('sha256').update(refreshToken, 'utf8').digest('hex');
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, token_lookup_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, tokenHash, tokenLookupHash, expiresAt]
    );
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
    console.error('Complete provider key error:', error);
    res.status(500).json({ error: 'Failed to complete login' });
  }
});

export default router;

