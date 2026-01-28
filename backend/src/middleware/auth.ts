import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';

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
    
    // Query all active tokens to check hashes
    const result = await query(
      `SELECT t.id, t.token_hash, t.user_id, t.scopes, t.wrapped_dek, t.revoked_at, t.expires_at, u.email
       FROM api_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.revoked_at IS NULL 
       AND (t.expires_at IS NULL OR t.expires_at > NOW())`,
      []
    );
    
    // Find matching token by comparing hashes
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(tokenPrefix, row.token_hash);
      if (isMatch) {
        // Update last_used_at
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
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
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
        const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
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

