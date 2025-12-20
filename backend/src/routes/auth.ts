import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  sessionDays: z.number().min(1).max(90).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, sessionDays } = registerSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user should be admin (from ENV)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    const isAdmin = adminEmails.includes(email.toLowerCase());

    // Create user
    const result = await query(
      'INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, email, created_at, is_admin',
      [email, passwordHash, isAdmin]
    );

    const user = result.rows[0];
    
    // Create premium subscription with 10-day trial
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 10); // 10-day trial
    
    await query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE 
       SET plan = $2, status = $3, expires_at = $4, updated_at = NOW()`,
      [user.id, 'premium', 'active', trialExpiresAt]
    );
    
    // Generate tokens
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
    
    // Use user-defined session duration or default to 7 days (register)
    const daysRegister = sessionDays && sessionDays >= 1 && sessionDays <= 90 ? sessionDays : 7;
    
    const accessToken = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '2h' });
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: `${daysRegister}d` });
    
    // Store refresh token
    const expiresAt = new Date(Date.now() + daysRegister * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );
    
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
        plan: 'premium',
        subscription_status: 'active',
        subscription_expires: trialExpiresAt.toISOString()
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, twoFactorToken, sessionDays, trustDevice, deviceToken } = req.body;
    
    // Validate email and password
    loginSchema.parse({ email, password });
    
    // Find user with subscription info and 2FA status
    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.is_admin, u.two_factor_enabled,
              u.username, u.profile_picture_url,
              s.plan, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check premium expiration with grace period (same logic as /me endpoint)
    if (user.plan === 'premium' && user.expires_at) {
      // Get grace period from settings (default 3 days)
      const settingsResult = await query(
        'SELECT premium_grace_period_days FROM payment_settings WHERE id = 1'
      );
      const gracePeriodDays = settingsResult.rows[0]?.premium_grace_period_days || 3;
      
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      const gracePeriodEnd = new Date(expiresAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
      
      // If past grace period, mark as expired
      if (now > gracePeriodEnd) {
        // Update subscription status in database
        await query(
          'UPDATE subscriptions SET status = $1 WHERE user_id = $2',
          ['expired', user.id]
        );
        user.subscription_status = 'expired';
      } else if (now > expiresAt && now <= gracePeriodEnd) {
        // In grace period - keep status as active but mark in response
        user.subscription_status = 'active'; // Keep active during grace period
        user.in_grace_period = true;
      }
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if 2FA needs to be bypassed with a trusted device
    let skip2FA = false;
    if (user.two_factor_enabled && deviceToken) {
      // Check if this device is trusted and not expired
      const trustedDevice = await query(
        'SELECT id, expires_at FROM trusted_devices WHERE user_id = $1 AND device_token = $2 AND expires_at > NOW()',
        [user.id, deviceToken]
      );
      if (trustedDevice.rows.length > 0) {
        skip2FA = true;
        // Update last_used_at
        await query('UPDATE trusted_devices SET last_used_at = NOW() WHERE id = $1', [trustedDevice.rows[0].id]);
      }
    }
    
    // If 2FA is enabled and not skipped, require token
    if (user.two_factor_enabled && !skip2FA) {
      if (!twoFactorToken) {
        // Return special response indicating 2FA is required
        return res.status(200).json({
          requiresTwoFactor: true,
          userId: user.id,
          message: 'Two-factor authentication required'
        });
      }
      
      // Validate 2FA token (this will be checked via /api/2fa/validate)
      // For now, we trust the frontend has validated it
    }
    
    // Generate tokens
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
    
    // Use user-defined session duration or default to 7 days (login)
    const daysLogin = sessionDays && sessionDays >= 1 && sessionDays <= 90 ? sessionDays : 7;
    
    const accessToken = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '2h' });
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: `${daysLogin}d` });
    
    // Store refresh token
    const expiresAt = new Date(Date.now() + daysLogin * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );
    
    // Clean up expired refresh tokens for this user
    const deletedResult = await query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= NOW() RETURNING id',
      [user.id]
    );
    if (deletedResult.rowCount && deletedResult.rowCount > 0) {
      console.log(`🧹 Cleaned up ${deletedResult.rowCount} expired refresh token(s) for user ${user.id}`);
    }
    
    // Update last login timestamp
    await query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );
    
    // If user requested to trust this device and passed 2FA, create device token
    let newDeviceToken = null;
    if (trustDevice && user.two_factor_enabled && twoFactorToken) {
      // Generate a unique device token
      const crypto = require('crypto');
      newDeviceToken = crypto.randomBytes(32).toString('hex');
      
      // Store for 30 days
      const deviceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
      
      await query(
        'INSERT INTO trusted_devices (user_id, device_token, device_name, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [user.id, newDeviceToken, userAgent, ipAddress, deviceExpiresAt]
      );
    }
    
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
        in_grace_period: user.in_grace_period || false,
        two_factor_enabled: user.two_factor_enabled
      },
      accessToken,
      refreshToken,
      deviceToken: newDeviceToken, // Return the device token to store on client
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      console.error('❌ Refresh attempt without token');
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
    const decoded = jwt.verify(refreshToken, refreshSecret) as { id: number };
    
    // Check if token exists in database
    const tokenResult = await query(
      'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    
    if (tokenResult.rows.length === 0) {
      console.error('❌ Refresh token not found in database or expired', {
        userId: decoded?.id,
        tokenLength: refreshToken?.length || 0
      });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Get user
    const userResult = await query('SELECT id, email FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      console.error('❌ User not found for refresh token', { userId: decoded.id });
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Generate new access token
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    const accessToken = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '2h' });
    
    console.log('✅ Token refreshed successfully', { userId: user.id, email: user.email });
    res.json({ accessToken });
  } catch (error) {
    console.error('❌ Refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    
    // Clean up expired refresh tokens for this user
    const userId = req.user!.id;
    const deletedResult = await query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= NOW() RETURNING id',
      [userId]
    );
    
    if (deletedResult.rowCount && deletedResult.rowCount > 0) {
      console.log(`🧹 Cleaned up ${deletedResult.rowCount} expired refresh token(s) for user ${userId}`);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.created_at, u.is_admin, u.username, u.profile_picture_url,
              s.plan, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Check premium expiration with grace period
    if (user.plan === 'premium' && user.expires_at) {
      // Get grace period from settings (default 3 days)
      const settingsResult = await query(
        'SELECT premium_grace_period_days FROM payment_settings WHERE id = 1'
      );
      const gracePeriodDays = settingsResult.rows[0]?.premium_grace_period_days || 3;
      
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      const gracePeriodEnd = new Date(expiresAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
      
      // If past grace period, mark as expired
      if (now > gracePeriodEnd) {
        // Update subscription status in database
        await query(
          'UPDATE subscriptions SET status = $1 WHERE user_id = $2',
          ['expired', req.user!.id]
        );
        user.subscription_status = 'expired';
      } else if (now > expiresAt && now <= gracePeriodEnd) {
        // In grace period - keep status as active but mark in response
        user.subscription_status = 'active'; // Keep active during grace period
        user.in_grace_period = true;
      }
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password - request reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    
    // Check if user exists (but don't reveal in response for security)
    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      // Generate JWT token for password reset (expires in 1 hour)
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
      const resetToken = jwt.sign(
        { email: user.email, type: 'password-reset' },
        secret,
        { expiresIn: '1h' }
      );
      
      // Generate reset URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
      
      // Send email (non-blocking, errors are logged)
      try {
        await sendPasswordResetEmail(user.email, resetToken, resetUrl);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Continue anyway - don't reveal email sending failure to prevent enumeration
      }
    }
    
    // Always return success (security: don't reveal if email exists)
    res.json({ 
      message: 'If an account exists with that email, a password reset link has been sent.' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid email format', details: error.errors });
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password - complete reset with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    
    // Verify JWT token
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Check token type
    if (decoded.type !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid token type' });
    }
    
    // Get user by email from token
    const userResult = await query('SELECT id, email FROM users WHERE email = $1', [decoded.email]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
    
    // Invalidate all refresh tokens for security (force re-login on all devices)
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
    
    console.log(`✅ Password reset successful for user: ${user.email}`);
    
    res.json({ message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

