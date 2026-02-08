import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db';
import { getJwtSecret } from '../env';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
  apiToken?: {
    id: number;
    scopes: string[];
    wrappedDek: string | null;
  };
  authType?: 'jwt' | 'api_token';
}

// Helper to verify API token
async function verifyApiToken(tokenString: string): Promise<{
  user: { id: number; email: string };
  apiToken: { id: number; scopes: string[]; wrappedDek: string | null };
} | null> {
  try {
    // Parse token format: tig.PREFIX.TEK
    // Example: tig.UZAwcnuC50dEwpgoiXSa3HRgRfter1y42VvXFqMA.base64urlTEK
    const parts = tokenString.split('.');
    
    if (parts.length < 2 || parts[0] !== 'tig') {
      return null;
    }
    
    // Extract the PREFIX (second part)
    const tokenPrefix = parts[1];
    
    if (!tokenPrefix) {
      return null;
    }
    
    const lookupHash = crypto.createHash('sha256').update(tokenPrefix, 'utf8').digest('hex');
    
    // O(1) lookup: find row by token_lookup_hash (new tokens)
    const result = await query(
      `SELECT t.id, t.token_hash, t.user_id, t.scopes, t.wrapped_dek, u.email
       FROM api_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token_lookup_hash = $1 AND t.revoked_at IS NULL
       AND (t.expires_at IS NULL OR t.expires_at > NOW())
       LIMIT 1`,
      [lookupHash]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const isMatch = await bcrypt.compare(tokenPrefix, row.token_hash);
      if (isMatch) {
        await query(
          'UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1',
          [row.id]
        );
        return {
          user: { id: row.user_id, email: row.email },
          apiToken: {
            id: row.id,
            scopes: row.scopes,
            wrappedDek: row.wrapped_dek
          }
        };
      }
    }
    
    // Fallback: legacy tokens without token_lookup_hash (O(n))
    const legacyResult = await query(
      `SELECT t.id, t.token_hash, t.user_id, t.scopes, t.wrapped_dek, u.email
       FROM api_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token_lookup_hash IS NULL AND t.revoked_at IS NULL
       AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
      []
    );
    for (const row of legacyResult.rows) {
      const isMatch = await bcrypt.compare(tokenPrefix, row.token_hash);
      if (isMatch) {
        await query(
          'UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1',
          [row.id]
        );
        return {
          user: { id: row.user_id, email: row.email },
          apiToken: {
            id: row.id,
            scopes: row.scopes,
            wrappedDek: row.wrapped_dek
          }
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('API token verification error:', error);
    return null;
  }
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Check if it's an API token (starts with 'tig.')
    if (token.startsWith('tig.')) {
      const apiTokenData = await verifyApiToken(token);
      
      if (!apiTokenData) {
        return res.status(401).json({ error: 'Invalid or expired API token' });
      }
      
      req.user = apiTokenData.user;
      req.apiToken = apiTokenData.apiToken;
      req.authType = 'api_token';
      
      return next();
    }
    
    // Otherwise, treat as JWT
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { id: number; email: string };
    req.user = decoded;
    req.authType = 'jwt';
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Check if it's an API token
      if (token.startsWith('tig.')) {
        const apiTokenData = await verifyApiToken(token);
        if (apiTokenData) {
          req.user = apiTokenData.user;
          req.apiToken = apiTokenData.apiToken;
          req.authType = 'api_token';
        }
      } else {
        // JWT token
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret) as { id: number; email: string };
        req.user = decoded;
        req.authType = 'jwt';
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

