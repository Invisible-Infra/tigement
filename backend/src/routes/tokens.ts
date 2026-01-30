import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Allowed API token scopes (must match middleware/scopes.ts)
const ALLOWED_SCOPES = new Set([
  'workspace:read', 'workspace:write', 'tables:read', 'tables:write',
  'tasks:read', 'tasks:write', 'notebooks:read', 'notebooks:write',
  'diaries:read', 'diaries:write', 'archives:read', 'archives:write',
  'settings:read', 'settings:write', '*:*'
]);
const ALLOWED_WILDCARD_PREFIXES = ['workspace', 'tables', 'tasks', 'notebooks', 'diaries', 'archives', 'settings'];

function isAllowedScope(scope: string): boolean {
  if (ALLOWED_SCOPES.has(scope)) return true;
  if (scope.endsWith(':*') && ALLOWED_WILDCARD_PREFIXES.includes(scope.slice(0, -2))) return true;
  return false;
}

// Admin-only scopes (non-admin users cannot request these); empty for now
const ADMIN_ONLY_SCOPES: string[] = [];

// Schema for token generation
const generateTokenSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string().min(1)).min(1).refine(
    (arr) => arr.every((s) => isAllowedScope(s)),
    { message: 'One or more scopes are invalid; use workspace:read, tables:write, *:* etc.' }
  ),
  enableDecryption: z.boolean().default(false),
  expiresInDays: z.number().min(1).max(365).nullable().optional(),
  encryptionKey: z.string().optional(), // Encryption key from frontend (for wrapping DEK)
});

// Generate random token prefix (32 bytes = 43 base64url chars)
function generateTokenPrefix(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate TEK (Token Encryption Key) - 32 bytes
function generateTEK(): Buffer {
  return crypto.randomBytes(32);
}

// Wrap DEK with TEK using AES-256-GCM
function wrapDEK(dek: Buffer, tek: Buffer): string {
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', tek, iv);
  
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: iv (12 bytes) + authTag (16 bytes) + encrypted DEK
  const wrappedDek = Buffer.concat([iv, authTag, encrypted]);
  return wrappedDek.toString('base64');
}

// Derive DEK from encryption key using PBKDF2 (matching frontend encryption.ts)
async function deriveDEK(encryptionKey: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Use a fixed salt for DEK derivation (same as frontend wrapping approach)
    // Note: This is a simplified version. In production, coordinate with frontend
    const salt = Buffer.from('tigement-dek-derivation-salt-v1'); // Fixed salt for key derivation
    crypto.pbkdf2(encryptionKey, salt, 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// POST /api/tokens/generate - Generate new API token
router.post('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, scopes, enableDecryption, expiresInDays, encryptionKey } = generateTokenSchema.parse(req.body);
    
    // Reject non-admin users requesting admin-only scopes
    const requestedAdminScopes = scopes.filter((s) => ADMIN_ONLY_SCOPES.includes(s));
    if (requestedAdminScopes.length > 0) {
      const isAdminResult = await query('SELECT is_admin FROM users WHERE id = $1', [req.user!.id]);
      const isAdmin = isAdminResult.rows.length > 0 && isAdminResult.rows[0].is_admin === true;
      if (!isAdmin) {
        return res.status(403).json({ error: 'Insufficient permissions for requested scopes' });
      }
    }
    
    if (enableDecryption && !encryptionKey) {
      return res.status(400).json({ 
        error: 'encryptionKey is required when enableDecryption is true' 
      });
    }
    
    // Generate token components
    const tokenPrefix = generateTokenPrefix();
    const tokenHash = await bcrypt.hash(tokenPrefix, 10);
    const tokenLookupHash = crypto.createHash('sha256').update(tokenPrefix, 'utf8').digest('hex');
    
    let wrappedDek: string | null = null;
    let tek: Buffer | null = null;
    
    if (enableDecryption && encryptionKey) {
      // Generate TEK
      tek = generateTEK();
      
      // Wrap the encryption key (password) directly with TEK
      // Don't derive - we need the actual password for workspace decryption
      wrappedDek = wrapDEK(Buffer.from(encryptionKey), tek);
    }
    
    // Calculate expiration
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    
    // Store token in database
    const result = await query(
      `INSERT INTO api_tokens (user_id, name, token_hash, token_lookup_hash, scopes, wrapped_dek, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, scopes, expires_at, created_at`,
      [req.user!.id, name, tokenHash, tokenLookupHash, scopes, wrappedDek, expiresAt]
    );
    
    const tokenRecord = result.rows[0];
    
    // Construct full token string
    // Format: tig.{tokenPrefix}.{TEK_base64url} or tig.{tokenPrefix} (if no decryption)
    // Using . separator to avoid conflict with base64url character set (_ and -)
    const tokenString = enableDecryption && tek
      ? `tig.${tokenPrefix}.${tek.toString('base64url')}`
      : `tig.${tokenPrefix}`;
    
    res.status(201).json({
      token: tokenString,
      tokenId: tokenRecord.id,
      name: tokenRecord.name,
      scopes: tokenRecord.scopes,
      canDecrypt: enableDecryption,
      expiresAt: tokenRecord.expires_at,
      createdAt: tokenRecord.created_at,
      warning: 'Store this token securely. It will not be shown again. Treat it like a password.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// GET /api/tokens - List user's API tokens
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, name, scopes, wrapped_dek IS NOT NULL as can_decrypt, 
              last_used_at, expires_at, created_at, revoked_at
       FROM api_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    );
    
    const tokens = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      scopes: row.scopes,
      canDecrypt: row.can_decrypt,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isActive: row.revoked_at === null && (!row.expires_at || new Date(row.expires_at) > new Date()),
      revokedAt: row.revoked_at
    }));
    
    res.json({ tokens });
  } catch (error) {
    console.error('List tokens error:', error);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

// DELETE /api/tokens/:id - Revoke API token
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    // Verify token belongs to user
    const checkResult = await query(
      'SELECT id FROM api_tokens WHERE id = $1 AND user_id = $2',
      [tokenId, req.user!.id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Revoke token (soft delete)
    await query(
      'UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1',
      [tokenId]
    );
    
    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error('Revoke token error:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// GET /api/tokens/:id - Get specific token details (without token string)
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    const result = await query(
      `SELECT id, name, scopes, wrapped_dek IS NOT NULL as can_decrypt,
              last_used_at, expires_at, created_at, revoked_at
       FROM api_tokens
       WHERE id = $1 AND user_id = $2`,
      [tokenId, req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const token = result.rows[0];
    
    res.json({
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      canDecrypt: token.can_decrypt,
      lastUsedAt: token.last_used_at,
      expiresAt: token.expires_at,
      createdAt: token.created_at,
      isActive: token.revoked_at === null && (!token.expires_at || new Date(token.expires_at) > new Date()),
      revokedAt: token.revoked_at
    });
  } catch (error) {
    console.error('Get token error:', error);
    res.status(500).json({ error: 'Failed to get token details' });
  }
});

export default router;
