import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer for profile picture uploads
const uploadDir = path.join(__dirname, '../../public/uploads/profiles');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user!.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Get current user profile
router.get('/profile', async (req: AuthRequest, res) => {
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

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile display (username and/or profile picture)
const updateDisplayProfileSchema = z.object({
  username: z.string().min(1).max(100).optional().nullable(),
  // Accept both full URLs (https://...) and relative paths (/uploads/...)
  profile_picture_url: z.string().min(1).optional().nullable(),
});

router.patch('/profile/display', async (req: AuthRequest, res) => {
  try {
    const { username, profile_picture_url } = updateDisplayProfileSchema.parse(req.body);
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (username !== undefined) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    
    if (profile_picture_url !== undefined) {
      updates.push(`profile_picture_url = $${paramCount++}`);
      values.push(profile_picture_url);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.user!.id);
    
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );
    
    res.json({ success: true, message: 'Profile display updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update profile display error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload profile picture
router.post('/profile/picture', upload.single('picture'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user!.id;
    const filename = req.file.filename;
    const url = `/uploads/profiles/${filename}`;

    // Update user's profile_picture_url in database
    await query(
      'UPDATE users SET profile_picture_url = $1 WHERE id = $2',
      [url, userId]
    );

    // Delete old profile picture if it exists and is local
    const userResult = await query('SELECT profile_picture_url FROM users WHERE id = $1', [userId]);
    const oldUrl = userResult.rows[0]?.profile_picture_url;
    if (oldUrl && oldUrl.startsWith('/uploads/profiles/')) {
      const oldPath = path.join(__dirname, '../../public', oldUrl);
      if (fs.existsSync(oldPath) && oldPath !== path.join(uploadDir, filename)) {
        fs.unlinkSync(oldPath);
      }
    }

    res.json({ 
      success: true, 
      url,
      message: 'Profile picture uploaded successfully' 
    });
  } catch (error: any) {
    console.error('Upload profile picture error:', error);
    
    // Delete uploaded file if database update fails
    if (req.file) {
      const filePath = path.join(uploadDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update profile (email and/or password)
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  currentPassword: z.string().min(1),
}).refine(data => data.email || data.password, {
  message: 'Either email or password must be provided',
});

router.put('/profile', async (req: AuthRequest, res) => {
  try {
    const { email, password, currentPassword } = updateProfileSchema.parse(req.body);

    // Verify current password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update email if provided
    if (email) {
      // Check if email already exists
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user!.id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      await query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user!.id]);
    }

    // Update password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user!.id]);

      // Invalidate all refresh tokens
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user!.id]);

      // Revoke all API tokens (same as rotate-encryption-key)
      await query(
        'UPDATE api_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [req.user!.id]
      );
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete account
const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal(true),
});

router.delete('/account', async (req: AuthRequest, res) => {
  try {
    const { password, confirm } = deleteAccountSchema.parse(req.body);

    // Verify password
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [req.user!.id]);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sharing public key (X25519 for ECDH table sharing)
const sharingPublicKeySchema = z.object({
  publicKey: z.string().min(32).max(500),
});

router.post('/sharing-public-key', async (req: AuthRequest, res) => {
  try {
    const { publicKey } = sharingPublicKeySchema.parse(req.body);
    await query(
      `INSERT INTO user_public_keys (user_id, public_key) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET public_key = $2`,
      [req.user!.id, publicKey]
    );
    res.json({ success: true, message: 'Public key saved' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Sharing public key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get public key by email (for share creation; requires auth)
router.get('/public-key-by-email', async (req: AuthRequest, res) => {
  try {
    const email = req.query.email as string;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email query parameter required' });
    }
    const result = await query(
      `SELECT u.id as user_id, pk.public_key
       FROM users u
       LEFT JOIN user_public_keys pk ON u.id = pk.user_id
       WHERE u.email = $1`,
      [email.trim().toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const row = result.rows[0];
    if (!row.public_key) {
      return res.status(404).json({ error: 'User has not set up sharing yet' });
    }
    res.json({ userId: row.user_id, publicKey: row.public_key });
  } catch (error) {
    console.error('Get public key by email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotate encryption key
const rotateKeySchema = z.object({
  invalidateTokens: z.boolean().default(true),
});

router.post('/rotate-encryption-key', async (req: AuthRequest, res) => {
  try {
    const { invalidateTokens } = rotateKeySchema.parse(req.body);
    
    if (invalidateTokens) {
      // Revoke all API tokens (default, more secure)
      await query(
        'UPDATE api_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [req.user!.id]
      );
      
      res.json({ 
        success: true, 
        message: 'All API tokens have been revoked. Please regenerate tokens with your new encryption key.',
        tokensRevoked: true
      });
    } else {
      // Note: Re-wrapping DEKs requires old and new keys from client
      // This is a placeholder - actual re-wrapping happens client-side
      res.json({ 
        success: true, 
        message: 'Encryption key rotation initiated. API tokens will continue to work.',
        tokensRevoked: false,
        warning: 'Re-wrapping DEKs must be done client-side with both old and new keys'
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Rotate encryption key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

