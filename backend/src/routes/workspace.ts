import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const saveWorkspaceSchema = z.object({
  encryptedData: z.string(),
  version: z.number().int().positive(),
});

// Get workspace data
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT encrypted_data, version, updated_at FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ data: null, version: 0 });
    }
    
    const workspace = result.rows[0];
    res.json({
      data: workspace.encrypted_data,
      version: workspace.version,
      updatedAt: workspace.updated_at,
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save workspace data (upsert)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { encryptedData, version } = saveWorkspaceSchema.parse(req.body);
    
    // Validate encrypted data size (empty workspace still encrypts to ~200-300 bytes minimum)
    // Reject suspiciously small data that might indicate corruption or empty state
    if (encryptedData.length < 100) {
      console.error(`Invalid encrypted data size: ${encryptedData.length} bytes (too small)`)
      return res.status(400).json({ 
        error: 'Invalid encrypted data: data size is too small. This might indicate corrupted or empty data.' 
      });
    }
    
    // Check if workspace exists
    const existing = await query(
      'SELECT version FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (existing.rows.length > 0) {
      // Update existing
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
      // Insert new
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

// Check version (for sync)
router.get('/version', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT version, updated_at FROM workspaces WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ version: 0, updatedAt: null });
    }
    
    res.json({
      version: result.rows[0].version,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error('Check version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

