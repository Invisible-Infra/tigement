import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireScopes } from '../middleware/scopes';
import { rateLimitApiToken } from '../middleware/rateLimit';

const router = Router();

// ============================================================================
// WORKSPACE BLOB OPERATIONS (encrypted)
// ============================================================================

// GET /api/v1/workspace - Get encrypted workspace blob
router.get('/workspace', authMiddleware, rateLimitApiToken('read'), requireScopes('workspace:read'), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT encrypted_data, version, updated_at FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ data: null, version: 0 });
    }
    
    const workspace = result.rows[0];
    
    // If API token with decryption capability, include wrapped_dek
    const response: any = {
      data: workspace.encrypted_data,
      version: workspace.version,
      updatedAt: workspace.updated_at,
    };
    
    if (req.apiToken?.wrappedDek) {
      response.wrappedDek = req.apiToken.wrappedDek;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/workspace - Save encrypted workspace blob
const saveWorkspaceSchema = z.object({
  encryptedData: z.string().min(100),
  version: z.number().int().positive(),
});

router.post('/workspace', authMiddleware, rateLimitApiToken('write'), requireScopes('workspace:write'), async (req: AuthRequest, res) => {
  try {
    const { encryptedData, version } = saveWorkspaceSchema.parse(req.body);
    
    const existing = await query(
      'SELECT version FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (existing.rows.length > 0) {
      const currentVersion = existing.rows[0].version;
      if (version <= currentVersion) {
        return res.status(409).json({ 
          error: 'Version conflict',
          currentVersion,
          message: 'Your local data is outdated. Please sync first.',
        });
      }
      
      await query(
        'UPDATE workspaces SET encrypted_data = $1, version = $2, updated_at = NOW() WHERE user_id = $3',
        [encryptedData, version, req.user!.id]
      );
    } else {
      await query(
        'INSERT INTO workspaces (user_id, encrypted_data, version) VALUES ($1, $2, $3)',
        [req.user!.id, encryptedData, version]
      );
    }
    
    res.json({ success: true, version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Save workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DECRYPTED RESOURCE OPERATIONS
// Note: These endpoints require client-side decryption/re-encryption
// Server returns encrypted blob + wrapped_dek, client processes, returns updated blob
// ============================================================================

// Helper function to get and decrypt workspace (client-side operation)
// This endpoint returns data for client-side processing
router.get('/workspace/for-edit', authMiddleware, rateLimitApiToken('read'), requireScopes('workspace:read'), async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT encrypted_data, version FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    const response: any = {
      encryptedData: result.rows[0].encrypted_data,
      version: result.rows[0].version,
    };
    
    // Include wrapped_dek for API tokens with decryption
    if (req.apiToken?.wrappedDek) {
      response.wrappedDek = req.apiToken.wrappedDek;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Get workspace for edit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
