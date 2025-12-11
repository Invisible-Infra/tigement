/**
 * Coupon Routes - Referral coupon claiming and statistics
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { query } from '../db';

const router = Router();

/**
 * Generate a random coupon code
 */
function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format as XXX-XXX-XXX-XXX
  return code.match(/.{1,3}/g)?.join('-') || code;
}

/**
 * POST /api/coupons/claim
 * Generate referral coupons for authenticated user
 */
router.post('/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check if referral system is enabled
    const settingsResult = await query(
      'SELECT * FROM coupon_settings WHERE id = 1'
    );

    if (settingsResult.rows.length === 0) {
      return res.status(400).json({ error: 'Coupon system not configured' });
    }

    const settings = settingsResult.rows[0];

    if (!settings.referral_system_enabled) {
      return res.status(400).json({ error: 'Referral coupon system is currently disabled' });
    }

    // Check if user has premium
    const subscriptionResult = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND plan = $2 AND status = $3',
      [userId, 'premium', 'active']
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(403).json({ error: 'You need an active premium subscription to claim referral coupons' });
    }

    // Get or create user allocation
    let allocationResult = await query(
      'SELECT * FROM user_coupon_allocations WHERE user_id = $1',
      [userId]
    );

    let allocation;
    if (allocationResult.rows.length === 0) {
      // Create initial allocation (user gets coupons for their own purchase)
      const couponsPerPurchase = settings.coupons_per_purchase || 3;
      await query(
        'INSERT INTO user_coupon_allocations (user_id, allocated_coupons, claimed_coupons) VALUES ($1, $2, 0)',
        [userId, couponsPerPurchase]
      );
      allocationResult = await query(
        'SELECT * FROM user_coupon_allocations WHERE user_id = $1',
        [userId]
      );
    }

    allocation = allocationResult.rows[0];

    // Calculate how many coupons user can claim
    const availableToClaim = allocation.allocated_coupons - allocation.claimed_coupons;

    if (availableToClaim <= 0) {
      return res.status(400).json({ 
        error: 'No coupons available to claim',
        allocated: allocation.allocated_coupons,
        claimed: allocation.claimed_coupons
      });
    }

    // Get months per coupon (check user override first, then global setting)
    const monthsPerCoupon = allocation.months_per_coupon_override || settings.months_per_coupon || 1;

    // Generate coupon codes
    const generatedCoupons = [];
    for (let i = 0; i < availableToClaim; i++) {
      const code = generateCouponCode();
      
      await query(
        `INSERT INTO coupons (code, discount_percent, coupon_type, generated_by_user_id, months_granted, is_active, max_uses)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [code, 100, 'referral', userId, monthsPerCoupon, true, 1]
      );

      generatedCoupons.push({
        code,
        monthsGranted: monthsPerCoupon,
        isActive: true
      });
    }

    // Update claimed count
    await query(
      'UPDATE user_coupon_allocations SET claimed_coupons = $1 WHERE user_id = $2',
      [allocation.claimed_coupons + availableToClaim, userId]
    );

    res.json({
      success: true,
      coupons: generatedCoupons,
      totalGenerated: availableToClaim,
      monthsPerCoupon
    });
  } catch (error: any) {
    console.error('Claim coupons error:', error);
    res.status(500).json({ error: 'Failed to generate coupons' });
  }
});

/**
 * GET /api/coupons/my-coupons
 * Get user's generated referral coupons with usage stats
 */
router.get('/my-coupons', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's generated coupons
    const couponsResult = await query(
      `SELECT c.id, c.code, c.discount_percent, c.months_granted, c.is_active, c.created_at,
              c.current_uses, c.max_uses,
              COALESCE(
                (SELECT json_agg(json_build_object('user_id', cu.user_id, 'used_at', cu.used_at))
                 FROM coupon_usage cu WHERE cu.coupon_id = c.id),
                '[]'::json
              ) as usage_details
       FROM coupons c
       WHERE c.generated_by_user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    // Get user's allocation info
    const allocationResult = await query(
      'SELECT * FROM user_coupon_allocations WHERE user_id = $1',
      [userId]
    );

    const allocation = allocationResult.rows[0] || {
      allocated_coupons: 0,
      claimed_coupons: 0
    };

    res.json({
      coupons: couponsResult.rows,
      allocation: {
        allocated: allocation.allocated_coupons,
        claimed: allocation.claimed_coupons,
        available: allocation.allocated_coupons - allocation.claimed_coupons
      }
    });
  } catch (error: any) {
    console.error('Get my coupons error:', error);
    res.status(500).json({ error: 'Failed to load coupons' });
  }
});

/**
 * GET /api/coupons/statistics
 * Get user's referral statistics
 */
router.get('/statistics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Total coupons generated
    const totalGenerated = await query(
      'SELECT COUNT(*) as count FROM coupons WHERE generated_by_user_id = $1',
      [userId]
    );

    // Total coupons used
    const totalUsed = await query(
      `SELECT COUNT(*) as count FROM coupons c
       INNER JOIN coupon_usage cu ON c.id = cu.coupon_id
       WHERE c.generated_by_user_id = $1`,
      [userId]
    );

    // Active vs inactive coupons
    const activeCount = await query(
      'SELECT COUNT(*) as count FROM coupons WHERE generated_by_user_id = $1 AND is_active = true AND current_uses < max_uses',
      [userId]
    );

    // Total months granted through referrals
    const totalMonthsGranted = await query(
      `SELECT COALESCE(SUM(c.months_granted), 0) as total FROM coupons c
       INNER JOIN coupon_usage cu ON c.id = cu.coupon_id
       WHERE c.generated_by_user_id = $1`,
      [userId]
    );

    res.json({
      totalGenerated: parseInt(totalGenerated.rows[0].count),
      totalUsed: parseInt(totalUsed.rows[0].count),
      activeCount: parseInt(activeCount.rows[0].count),
      totalMonthsGranted: parseInt(totalMonthsGranted.rows[0].total),
      conversionRate: totalGenerated.rows[0].count > 0 
        ? (parseInt(totalUsed.rows[0].count) / parseInt(totalGenerated.rows[0].count) * 100).toFixed(1)
        : '0.0'
    });
  } catch (error: any) {
    console.error('Get coupon statistics error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

export default router;

