import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware to check if request has required scopes
 * JWT sessions have full access (bypass scope checks)
 * API tokens are checked against their scope array
 */
export const requireScopes = (...requiredScopes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // JWT sessions have full access (strict: only explicit jwt, not missing authType)
    if (req.authType === 'jwt') {
      return next();
    }
    
    // API token - check scopes
    if (req.authType === 'api_token' && req.apiToken) {
      const tokenScopes = req.apiToken.scopes || [];
      
      // Check for wildcard access
      if (tokenScopes.includes('*:*')) {
        return next();
      }
      
      // Check if token has all required scopes
      const hasAllScopes = requiredScopes.every(requiredScope => {
        // Check exact match
        if (tokenScopes.includes(requiredScope)) {
          return true;
        }
        
        // Check wildcard match (e.g., "tables:*" matches "tables:read")
        const [resource, action] = requiredScope.split(':');
        if (tokenScopes.includes(`${resource}:*`)) {
          return true;
        }
        
        return false;
      });
      
      if (!hasAllScopes) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredScopes,
          granted: tokenScopes,
          message: 'This API token does not have the required scopes for this operation'
        });
      }
      
      return next();
    }
    
    // No valid authentication
    return res.status(401).json({ error: 'Authentication required' });
  };
};

/**
 * Helper to check if user has specific scope (for conditional logic)
 */
export const hasScope = (req: AuthRequest, scope: string): boolean => {
  // JWT sessions have all scopes (strict: only explicit jwt, not missing authType)
  if (req.authType === 'jwt') {
    return true;
  }
  
  // API token - check scopes
  if (req.authType === 'api_token' && req.apiToken) {
    const tokenScopes = req.apiToken.scopes || [];
    
    // Check wildcard
    if (tokenScopes.includes('*:*')) {
      return true;
    }
    
    // Check exact match
    if (tokenScopes.includes(scope)) {
      return true;
    }
    
    // Check wildcard resource match
    const [resource] = scope.split(':');
    if (tokenScopes.includes(`${resource}:*`)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Supported scopes:
 * 
 * Resource-level scopes:
 * - workspace:read - Read entire workspace blob
 * - workspace:write - Write entire workspace blob
 * - tables:read - Read all tables
 * - tables:write - Create/update/delete tables
 * - tasks:read - Read tasks within tables
 * - tasks:write - Create/update/delete/reorder tasks
 * - notebooks:read - Read notebooks
 * - notebooks:write - Create/update/delete notebooks
 * - diaries:read - Read diary entries
 * - diaries:write - Create/update/delete diary entries
 * - archives:read - Read archived tables
 * - archives:write - Create/update/delete archives
 * - settings:read - Read workspace settings
 * - settings:write - Update settings
 * - *:* - Full access (all operations)
 * 
 * Wildcard patterns:
 * - tables:* - All table operations (read + write)
 * - tasks:* - All task operations (read + write)
 * etc.
 */
