/**
 * Table sharing routes (premium, E2EE)
 * Server stores only encrypted data; cannot decrypt
 */

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function requirePremium(req: AuthRequest, res: any): Promise<boolean> {
  const subResult = await query(
    `SELECT s.plan, s.status, s.expires_at,
            COALESCE(ps.premium_grace_period_days, 3) as grace_days
     FROM subscriptions s
     LEFT JOIN payment_settings ps ON 1=1
     WHERE s.user_id = $1
     ORDER BY s.started_at DESC LIMIT 1`,
    [req.user!.id]
  );
  if (subResult.rows.length === 0 || subResult.rows[0].plan !== 'premium') {
    res.status(403).json({ error: 'Table sharing requires premium subscription' });
    return false;
  }
  const sub = subResult.rows[0];
  if (sub.status === 'expired' || sub.status === 'cancelled') {
    const graceDays = sub.grace_days || 3;
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    const now = new Date();
    const graceEnd = expiresAt ? new Date(expiresAt) : null;
    if (graceEnd) graceEnd.setDate(graceEnd.getDate() + graceDays);
    if (!graceEnd || now > graceEnd) {
      res.status(403).json({ error: 'Table sharing requires active premium subscription' });
      return false;
    }
  }
  return true;
}

const createShareSchema = z.object({
  tableId: z.string().min(1),
  recipientEmail: z.string().email(),
  permission: z.enum(['view', 'edit']),
  encryptedTableData: z.string().min(1),
  encryptedDek: z.string().min(1),
  wrappedDekForOwner: z.string().optional(),
});

// POST /api/shares - Create share or add recipient
router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const { tableId, recipientEmail, permission, encryptedTableData, encryptedDek, wrappedDekForOwner } =
      createShareSchema.parse(req.body);

    const recipientResult = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [recipientEmail.trim()]
    );
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const recipientId = recipientResult.rows[0].id;
    if (recipientId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM shared_tables WHERE owner_id = $1 AND source_table_id = $2',
        [req.user!.id, tableId]
      );

      if (existing.rows.length > 0) {
        const st = existing.rows[0] as { id: number };
        const duplicateRecipient = await client.query(
          'SELECT id FROM shared_table_recipients WHERE shared_table_id = $1 AND user_id = $2',
          [st.id, recipientId]
        );
        if (duplicateRecipient.rows.length > 0) {
          await client.query(
            'UPDATE shared_table_recipients SET encrypted_dek = $1, permission = $2 WHERE shared_table_id = $3 AND user_id = $4',
            [encryptedDek, permission, st.id, recipientId]
          );
          return { success: true, sharedTableId: st.id, added: false };
        }
        await client.query(
          'INSERT INTO shared_table_recipients (shared_table_id, user_id, encrypted_dek, permission) VALUES ($1, $2, $3, $4)',
          [st.id, recipientId, encryptedDek, permission]
        );
        return { success: true, sharedTableId: st.id, added: true };
      }

      const insertResult = await client.query(
        `INSERT INTO shared_tables (owner_id, source_table_id, encrypted_table_data, version, wrapped_dek_for_owner)
         VALUES ($1, $2, $3, 1, $4) RETURNING id`,
        [req.user!.id, tableId, encryptedTableData, wrappedDekForOwner ?? null]
      );
      const st = insertResult.rows[0] as { id: number };
      await client.query(
        'INSERT INTO shared_table_recipients (shared_table_id, user_id, encrypted_dek, permission) VALUES ($1, $2, $3, $4)',
        [st.id, recipientId, encryptedDek, permission]
      );
      return { success: true, sharedTableId: st.id, added: true };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shares/incoming - Tables shared with me
router.get('/incoming', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await query(
      `SELECT st.id, st.owner_id, st.source_table_id, st.encrypted_table_data, st.version, st.updated_at,
              r.permission, r.encrypted_dek,
              u.email as owner_email,
              pk.public_key as owner_public_key
       FROM shared_table_recipients r
       JOIN shared_tables st ON st.id = r.shared_table_id
       JOIN users u ON u.id = st.owner_id
       LEFT JOIN user_public_keys pk ON pk.user_id = st.owner_id
       WHERE r.user_id = $1
       ORDER BY st.updated_at DESC`,
      [userId]
    );
    res.json({ shares: result.rows });
  } catch (error) {
    console.error('Get incoming shares error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shares/owned - Shared tables I own (for sync/merge; includes wrapped_dek_for_owner)
router.get('/owned', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const result = await query(
      `SELECT st.id, st.source_table_id, st.encrypted_table_data, st.version, st.wrapped_dek_for_owner,
              st.updated_at, st.last_pushed_by_user_id, st.last_resolved_at,
              u.email as last_pushed_by_email
       FROM shared_tables st
       LEFT JOIN users u ON u.id = st.last_pushed_by_user_id
       WHERE st.owner_id = $1 ORDER BY st.updated_at DESC`,
      [req.user!.id]
    );
    res.json({ shares: result.rows });
  } catch (error) {
    console.error('Get owned shares error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shares/outgoing - Shares I created
router.get('/outgoing', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const result = await query(
      `SELECT st.id, st.source_table_id, st.version, st.created_at, st.updated_at,
              json_agg(json_build_object('userId', r.user_id, 'email', u.email, 'permission', r.permission, 'always_accept_from', r.always_accept_from)) as recipients
       FROM shared_tables st
       LEFT JOIN shared_table_recipients r ON r.shared_table_id = st.id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE st.owner_id = $1
       GROUP BY st.id
       ORDER BY st.updated_at DESC`,
      [req.user!.id]
    );
    const shares = result.rows.map((r: any) => ({
      ...r,
      recipients: (r.recipients || []).filter((x: any) => x.userId != null),
    }));
    res.json({ shares });
  } catch (error) {
    console.error('Get outgoing shares error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/shares/:id - Update permission, revoke, or alwaysAcceptFrom
const updateShareSchema = z.object({
  permission: z.enum(['view', 'edit']).optional(),
  revokeUserId: z.number().optional(),
  recipientId: z.number().optional(),
  alwaysAcceptFrom: z.boolean().optional(),
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { permission, revokeUserId, recipientId, alwaysAcceptFrom } = updateShareSchema.parse(req.body);

    if (recipientId !== undefined && alwaysAcceptFrom !== undefined) {
      const ownerCheck = await query('SELECT owner_id FROM shared_tables WHERE id = $1', [id]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (ownerCheck.rows[0].owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
      const updateResult = await query(
        'UPDATE shared_table_recipients SET always_accept_from = $1 WHERE shared_table_id = $2 AND user_id = $3',
        [alwaysAcceptFrom, id, recipientId]
      );
      if (updateResult.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    }

    if (revokeUserId !== undefined) {
      const ownerCheck = await query('SELECT owner_id FROM shared_tables WHERE id = $1', [id]);
      if (ownerCheck.rows.length === 0) {
        const recCheck = await query(
          'SELECT r.shared_table_id, st.owner_id FROM shared_table_recipients r JOIN shared_tables st ON st.id = r.shared_table_id WHERE r.id = $1',
          [id]
        );
        if (recCheck.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        const stId = recCheck.rows[0].shared_table_id;
        const ownerId = recCheck.rows[0].owner_id;
        if (ownerId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
        await query('DELETE FROM shared_table_recipients WHERE shared_table_id = $1 AND user_id = $2', [
          stId,
          revokeUserId,
        ]);
        return res.json({ success: true });
      }
      if (ownerCheck.rows[0].owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
      await query('DELETE FROM shared_table_recipients WHERE shared_table_id = $1 AND user_id = $2', [
        id,
        revokeUserId,
      ]);
      return res.json({ success: true });
    }

    if (permission) {
      const ownerCheck = await query('SELECT owner_id FROM shared_tables WHERE id = $1', [id]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (ownerCheck.rows[0].owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
      const recId = req.query.recipientId as string;
      if (!recId) return res.status(400).json({ error: 'recipientId required for permission update' });
      if (!/^\d+$/.test(recId)) {
        return res.status(400).json({ error: 'recipientId must be a numeric id' });
      }
      const recIdNum = parseInt(recId, 10);
      await query(
        'UPDATE shared_table_recipients SET permission = $1 WHERE shared_table_id = $2 AND user_id = $3',
        [permission, id, recIdNum]
      );
      return res.json({ success: true });
    }

    res.status(400).json({ error: 'No action specified' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/shares/:id - Remove whole share (shared_table_id)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const ownerCheck = await query('SELECT owner_id FROM shared_tables WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (ownerCheck.rows[0].owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM shared_tables WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shares/:id/pushes - Owner fetches pending recipient pushes since last resolve
router.get('/:id/pushes', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const stResult = await query(
      'SELECT owner_id, last_resolved_at FROM shared_tables WHERE id = $1',
      [id]
    );
    if (stResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const st = stResult.rows[0];
    if (st.owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    const resolvedAt = st.last_resolved_at || new Date(0);
    const result = await query(
      `SELECT p.id, p.user_id, p.encrypted_table_data, p.version, p.pushed_at, u.email as user_email
       FROM shared_table_pushes p
       JOIN users u ON u.id = p.user_id
       WHERE p.shared_table_id = $1 AND p.pushed_at > $2 AND p.user_id != $3
       ORDER BY p.pushed_at ASC`,
      [id, resolvedAt, st.owner_id]
    );
    res.json({ pushes: result.rows });
  } catch (error) {
    console.error('Get share pushes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shares/:id/resolve - Owner submits merged result
const resolveSchema = z.object({
  encryptedTableData: z.string().min(1),
  version: z.number().int().positive(),
});

router.post('/:id/resolve', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { encryptedTableData, version } = resolveSchema.parse(req.body);
    const stResult = await query(
      'SELECT owner_id, version FROM shared_tables WHERE id = $1',
      [id]
    );
    if (stResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const st = stResult.rows[0];
    if (st.owner_id !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    if (version <= st.version) {
      return res.status(409).json({ error: 'Version conflict', currentVersion: st.version });
    }
    await query(
      `UPDATE shared_tables SET encrypted_table_data = $1, version = $2, updated_at = NOW(),
              last_resolved_at = NOW(), last_resolved_by_user_id = $3, last_pushed_by_user_id = $3
       WHERE id = $4`,
      [encryptedTableData, version, req.user!.id, id]
    );
    res.json({ success: true, version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Resolve share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/shares/:id - Update shared table data (owner or editor with edit permission)
const updateDataSchema = z.object({
  encryptedTableData: z.string().min(1),
  version: z.number().int().positive(),
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requirePremium(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const { encryptedTableData, version } = updateDataSchema.parse(req.body);

    const stResult = await query(
      'SELECT id, owner_id, version FROM shared_tables WHERE id = $1',
      [id]
    );
    if (stResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const st = stResult.rows[0];
    const isOwner = st.owner_id === req.user!.id;
    const recipientRow = await query(
      'SELECT permission FROM shared_table_recipients WHERE shared_table_id = $1 AND user_id = $2',
      [id, req.user!.id]
    );
    const isRecipientWithEdit = recipientRow.rows.length > 0 && recipientRow.rows[0].permission === 'edit';
    let canEdit = isOwner || isRecipientWithEdit;
    if (isRecipientWithEdit && !isOwner) {
      const premCheck = await query(
        'SELECT plan FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY started_at DESC LIMIT 1',
        [req.user!.id, 'active']
      );
      const isPremium = premCheck.rows.length > 0 && premCheck.rows[0].plan === 'premium';
      if (!isPremium) canEdit = false;
    }
    if (!canEdit) return res.status(403).json({ error: 'No edit permission' });

    await withTransaction(async (client) => {
      const lockResult = await client.query(
        'SELECT id, owner_id, version FROM shared_tables WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (lockResult.rows.length === 0) {
        const err = new Error('Not found') as Error & { httpStatus?: number };
        err.httpStatus = 404;
        throw err;
      }
      const locked = lockResult.rows[0];
      if (version <= locked.version) {
        const err = new Error('Version conflict') as Error & { httpStatus?: number; currentVersion?: number };
        err.httpStatus = 409;
        err.currentVersion = locked.version;
        throw err;
      }
      await client.query(
        'INSERT INTO shared_table_pushes (shared_table_id, user_id, encrypted_table_data, version) VALUES ($1, $2, $3, $4)',
        [id, req.user!.id, encryptedTableData, version]
      );
      const updateFields = [
        'encrypted_table_data = $1',
        'version = $2',
        'updated_at = NOW()',
        'last_pushed_by_user_id = $3',
      ];
      const updateParams: any[] = [encryptedTableData, version, req.user!.id];
      if (isOwner) {
        updateFields.push('last_resolved_at = NOW()');
        updateFields.push('last_resolved_by_user_id = $4');
        updateParams.push(req.user!.id);
        updateParams.push(id);
        updateParams.push(locked.version);
        const updateResult = await client.query(
          `UPDATE shared_tables SET ${updateFields.join(', ')} WHERE id = $5 AND version = $6`,
          updateParams
        );
        if (updateResult.rowCount === 0) {
          const err = new Error('Version conflict') as Error & { httpStatus?: number; currentVersion?: number };
          err.httpStatus = 409;
          err.currentVersion = locked.version;
          throw err;
        }
      } else {
        updateParams.push(id);
        updateParams.push(locked.version);
        const updateResult = await client.query(
          `UPDATE shared_tables SET ${updateFields.join(', ')} WHERE id = $4 AND version = $5`,
          updateParams
        );
        if (updateResult.rowCount === 0) {
          const err = new Error('Version conflict') as Error & { httpStatus?: number; currentVersion?: number };
          err.httpStatus = 409;
          err.currentVersion = locked.version;
          throw err;
        }
      }
    });
    res.json({ success: true, version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    const err = error as Error & { httpStatus?: number; currentVersion?: number };
    if (err.httpStatus === 404) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (err.httpStatus === 409) {
      return res.status(409).json({ error: 'Version conflict', currentVersion: err.currentVersion });
    }
    console.error('Update share data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
