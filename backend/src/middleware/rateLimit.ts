import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// In-memory rate limiting (for MVP, use Redis in production)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<number, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [tokenId, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(tokenId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware for API tokens
 * JWT sessions are not rate limited (trusted user sessions)
 * 
 * Limits per API token per minute:
 * - Read operations: 100 requests/minute
 * - Write operations: 30 requests/minute
 */
export const rateLimitApiToken = (operationType: 'read' | 'write' = 'read') => {
  const limit = operationType === 'read' ? 100 : 30;
  const windowMs = 60 * 1000; // 1 minute
  
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Skip rate limiting for JWT sessions
    if (req.authType === 'jwt' || !req.apiToken) {
      return next();
    }
    
    const tokenId = req.apiToken.id;
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(tokenId);
    
    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs
      };
      rateLimitStore.set(tokenId, entry);
    }
    
    // Increment counter
    entry.count++;
    
    // Check limit
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      res.set('X-RateLimit-Limit', limit.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `API token rate limit: ${limit} ${operationType} requests per minute`,
        retryAfter,
        limit,
        windowSeconds: 60
      });
    }
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', limit.toString());
    res.set('X-RateLimit-Remaining', (limit - entry.count).toString());
    res.set('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
    
    next();
  };
};
