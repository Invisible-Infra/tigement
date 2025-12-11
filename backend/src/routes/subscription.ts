import { Router } from 'express';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user subscription
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT plan, status, started_at, expires_at FROM subscriptions WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ plan: 'free', status: 'active' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create premium subscription (after BTC Pay confirmation)
router.post('/premium', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID required' });
    }
    
    // TODO: Verify payment with BTC Pay Server
    // For now, just create the subscription
    
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    
    await query(
      `UPDATE subscriptions 
       SET plan = $1, status = $2, started_at = NOW(), expires_at = $3, payment_id = $4, updated_at = NOW()
       WHERE user_id = $5`,
      ['premium', 'active', expiresAt, paymentId, req.user!.id]
    );
    
    res.json({ 
      success: true,
      plan: 'premium',
      expiresAt,
    });
  } catch (error) {
    console.error('Create premium subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel subscription
router.post('/cancel', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await query(
      'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE user_id = $2',
      ['cancelled', req.user!.id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

