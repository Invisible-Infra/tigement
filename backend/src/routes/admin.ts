import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

const router = Router();

/** Add months to a date, preserving end-of-month when overflow would occur (e.g. Jan 31 + 1 month -> Feb 28) */
function addMonthsSafe(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== day) {
    result.setDate(0); // Roll back to last day of previous month
  }
  return result;
}

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * GET /api/admin/payment-settings
 * Get BTC Pay Server configuration
 */
router.get('/payment-settings', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM payment_settings WHERE id = 1')
    if (result.rows.length === 0) {
      return res.json({
        btcpay_url: null,
        btcpay_store_id: null,
        btcpay_api_key: null,
        btcpay_webhook_secret: null,
        premium_monthly_price: 9.99,
        premium_yearly_price: 99.99,
        currency: 'USD'
      })
    }

    // Don't send full API key, just indicate if it's set
    const settings = result.rows[0]
    res.json({
      ...settings,
      btcpay_api_key: settings.btcpay_api_key ? '***configured***' : null,
      btcpay_webhook_secret: settings.btcpay_webhook_secret ? '***configured***' : null
    })
  } catch (error) {
    console.error('Get payment settings error:', error)
    res.status(500).json({ error: 'Failed to get payment settings' })
  }
})

/**
 * PUT /api/admin/payment-settings
 * Update BTC Pay Server configuration
 */
router.put('/payment-settings', async (req: AuthRequest, res) => {
  try {
    const { 
      btcpay_url, 
      btcpay_store_id, 
      btcpay_api_key, 
      btcpay_webhook_secret,
      premium_monthly_price,
      premium_yearly_price,
      currency,
      premium_grace_period_days
    } = req.body

    // Build update query dynamically (only update provided fields)
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (btcpay_url !== undefined) {
      updates.push(`btcpay_url = $${paramIndex++}`)
      values.push(btcpay_url)
    }
    if (btcpay_store_id !== undefined) {
      updates.push(`btcpay_store_id = $${paramIndex++}`)
      values.push(btcpay_store_id)
    }
    if (btcpay_api_key !== undefined && btcpay_api_key !== '***configured***') {
      updates.push(`btcpay_api_key = $${paramIndex++}`)
      values.push(btcpay_api_key)
    }
    if (btcpay_webhook_secret !== undefined && btcpay_webhook_secret !== '***configured***') {
      updates.push(`btcpay_webhook_secret = $${paramIndex++}`)
      values.push(btcpay_webhook_secret)
    }
    if (premium_monthly_price !== undefined) {
      updates.push(`premium_monthly_price = $${paramIndex++}`)
      values.push(premium_monthly_price)
    }
    if (premium_yearly_price !== undefined) {
      updates.push(`premium_yearly_price = $${paramIndex++}`)
      values.push(premium_yearly_price)
    }
    if (currency !== undefined) {
      updates.push(`currency = $${paramIndex++}`)
      values.push(currency)
    }
    if (premium_grace_period_days !== undefined) {
      updates.push(`premium_grace_period_days = $${paramIndex++}`)
      values.push(premium_grace_period_days)
    }

    updates.push(`updated_at = NOW()`)
    updates.push(`updated_by = $${paramIndex++}`)
    values.push(req.user!.id)

    await query(
      `UPDATE payment_settings SET ${updates.join(', ')} WHERE id = 1`,
      values
    )

    res.json({ success: true, message: 'Payment settings updated' })
  } catch (error) {
    console.error('Update payment settings error:', error)
    res.status(500).json({ error: 'Failed to update payment settings' })
  }
})

/**
 * GET /api/admin/payment-methods
 * Get all payment methods
 */
router.get('/payment-methods', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT * FROM payment_methods ORDER BY display_order ASC, id ASC'
    )
    
    res.json(result.rows)
  } catch (error) {
    console.error('Get payment methods error:', error)
    res.status(500).json({ error: 'Failed to get payment methods' })
  }
})

/**
 * PUT /api/admin/payment-methods/:id
 * Update payment method
 */
router.put('/payment-methods/:id', async (req: AuthRequest, res) => {
  try {
    const methodId = parseInt(req.params.id)
    const {
      enabled,
      display_order,
      discount_percent,
      discount_amount,
      config
    } = req.body

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`)
      values.push(enabled)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (discount_percent !== undefined) {
      updates.push(`discount_percent = $${paramIndex++}`)
      values.push(discount_percent)
    }
    if (discount_amount !== undefined) {
      updates.push(`discount_amount = $${paramIndex++}`)
      values.push(discount_amount)
    }
    if (config !== undefined) {
      updates.push(`config = $${paramIndex++}`)
      values.push(JSON.stringify(config))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    values.push(methodId)
    await query(
      `UPDATE payment_methods SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )

    res.json({ success: true, message: 'Payment method updated' })
  } catch (error) {
    console.error('Update payment method error:', error)
    res.status(500).json({ error: 'Failed to update payment method' })
  }
})

// Get all users with pagination
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params: any[] = [limit, offset];
    
    if (search) {
      whereClause = 'WHERE email ILIKE $3';
      params.push(`%${search}%`);
    }

    const result = await query(
      `SELECT u.id, u.email, u.is_admin, u.created_at,
              s.plan, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      search ? [`%${search}%`] : []
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user details
router.get('/users/:id', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);

    const result = await query(
      `SELECT u.id, u.email, u.is_admin, u.created_at,
              s.plan, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grant/revoke premium status
const premiumSchema = z.object({
  premium: z.boolean(),
  months: z.number().int().positive().optional(),
});

router.put('/users/:id/premium', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { premium, months = 12 } = premiumSchema.parse(req.body);

    if (premium) {
      // Grant premium
      const expiresAt = addMonthsSafe(new Date(), months);

      await query(
        `INSERT INTO subscriptions (user_id, plan, status, expires_at)
         VALUES ($1, 'premium', 'active', $2)
         ON CONFLICT (user_id) 
         DO UPDATE SET plan = 'premium', status = 'active', expires_at = $2`,
        [userId, expiresAt]
      );
    } else {
      // Revoke premium
      await query(
        `UPDATE subscriptions SET plan = 'free', status = 'cancelled', expires_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    }

    res.json({ success: true, message: premium ? 'Premium granted' : 'Premium revoked' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update premium error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set specific premium expiration date
router.put('/users/:id/premium-expiry', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id)
    const { expires_at } = req.body

    if (!expires_at) {
      return res.status(400).json({ error: 'expires_at is required' })
    }

    const expiryDate = new Date(expires_at)
    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }

    // Check if subscription exists
    const existing = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    )

    if (existing.rows.length > 0) {
      // Update existing subscription
      await query(
        `UPDATE subscriptions 
         SET plan = 'premium', status = 'active', expires_at = $1, updated_at = NOW() 
         WHERE user_id = $2`,
        [expiryDate, userId]
      )
    } else {
      // Create new subscription
      await query(
        `INSERT INTO subscriptions (user_id, plan, status, expires_at)
         VALUES ($1, 'premium', 'active', $2)`,
        [userId, expiryDate]
      )
    }

    res.json({ success: true, message: 'Premium expiration updated' })
  } catch (error) {
    console.error('Update premium expiry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create coupon
const couponSchema = z.object({
  code: z.string().min(3).max(50),
  discount_percent: z.number().int().min(1).max(100),
  valid_until: z.string().optional(),
  max_uses: z.number().int().positive().optional(),
});

router.post('/coupons', async (req: AuthRequest, res) => {
  try {
    const { code, discount_percent, valid_until, max_uses } = couponSchema.parse(req.body);

    const result = await query(
      `INSERT INTO coupons (code, discount_percent, valid_until, max_uses, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [code, discount_percent, valid_until || null, max_uses || null, req.user!.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all coupons
router.get('/coupons', async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.email as created_by_email
       FROM coupons c
       LEFT JOIN users u ON c.created_by = u.id
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete coupon
router.delete('/coupons/:code', async (req: AuthRequest, res) => {
  try {
    const { code } = req.params;

    const result = await query('DELETE FROM coupons WHERE code = $1 RETURNING *', [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/coupon-settings
 * Get referral coupon system settings
 */
router.get('/coupon-settings', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM coupon_settings WHERE id = 1')
    
    if (result.rows.length === 0) {
      // Return defaults if not configured yet
      return res.json({
        referral_system_enabled: false,
        coupons_per_purchase: 3,
        months_per_coupon: 1,
        allow_user_overrides: false
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Get coupon settings error:', error)
    res.status(500).json({ error: 'Failed to get coupon settings' })
  }
})

/**
 * PUT /api/admin/coupon-settings
 * Update referral coupon system settings
 */
router.put('/coupon-settings', async (req: AuthRequest, res) => {
  try {
    const {
      referral_system_enabled,
      coupons_per_purchase,
      months_per_coupon,
      allow_user_overrides,
      invalidate_existing
    } = req.body

    // Check if settings exist
    const checkResult = await query('SELECT id FROM coupon_settings WHERE id = 1')
    
    if (checkResult.rows.length === 0) {
      // Insert initial settings
      await query(
        `INSERT INTO coupon_settings (id, referral_system_enabled, coupons_per_purchase, months_per_coupon, allow_user_overrides)
         VALUES (1, $1, $2, $3, $4)`,
        [
          referral_system_enabled || false,
          coupons_per_purchase || 3,
          months_per_coupon || 1,
          allow_user_overrides || false
        ]
      )
    } else {
      // Update existing settings
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (referral_system_enabled !== undefined) {
        updates.push(`referral_system_enabled = $${paramIndex++}`)
        values.push(referral_system_enabled)
      }
      if (coupons_per_purchase !== undefined) {
        updates.push(`coupons_per_purchase = $${paramIndex++}`)
        values.push(coupons_per_purchase)
      }
      if (months_per_coupon !== undefined) {
        updates.push(`months_per_coupon = $${paramIndex++}`)
        values.push(months_per_coupon)
      }
      if (allow_user_overrides !== undefined) {
        updates.push(`allow_user_overrides = $${paramIndex++}`)
        values.push(allow_user_overrides)
      }

      if (updates.length > 0) {
        await query(
          `UPDATE coupon_settings SET ${updates.join(', ')} WHERE id = 1`,
          values
        )
      }
    }

    // If disabling and invalidating existing referral coupons
    if (referral_system_enabled === false && invalidate_existing === true) {
      await query(
        `UPDATE coupons SET is_active = false WHERE coupon_type = 'referral' AND is_active = true`
      )
      console.log('Invalidated all existing referral coupons')
    }

    res.json({ success: true, message: 'Coupon settings updated' })
  } catch (error) {
    console.error('Update coupon settings error:', error)
    res.status(500).json({ error: 'Failed to update coupon settings' })
  }
})

/**
 * GET /api/admin/users/:id/coupon-allocation
 * Get user-specific coupon allocation
 */
router.get('/users/:id/coupon-allocation', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id)

    const result = await query(
      'SELECT * FROM user_coupon_allocations WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.json({
        allocated_coupons: 0,
        claimed_coupons: 0,
        coupons_per_purchase_override: null,
        months_per_coupon_override: null
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Get user coupon allocation error:', error)
    res.status(500).json({ error: 'Failed to get coupon allocation' })
  }
})

/**
 * PUT /api/admin/users/:id/coupon-allocation
 * Update user-specific coupon allocation overrides
 */
router.put('/users/:id/coupon-allocation', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id)
    const {
      allocated_coupons,
      coupons_per_purchase_override,
      months_per_coupon_override
    } = req.body

    // Check if allocation exists
    const checkResult = await query(
      'SELECT * FROM user_coupon_allocations WHERE user_id = $1',
      [userId]
    )

    if (checkResult.rows.length === 0) {
      // Create new allocation
      await query(
        `INSERT INTO user_coupon_allocations (user_id, allocated_coupons, claimed_coupons, coupons_per_purchase_override, months_per_coupon_override)
         VALUES ($1, $2, 0, $3, $4)`,
        [userId, allocated_coupons || 0, coupons_per_purchase_override, months_per_coupon_override]
      )
    } else {
      // Update existing allocation
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (allocated_coupons !== undefined) {
        updates.push(`allocated_coupons = $${paramIndex++}`)
        values.push(allocated_coupons)
      }
      if (coupons_per_purchase_override !== undefined) {
        updates.push(`coupons_per_purchase_override = $${paramIndex++}`)
        values.push(coupons_per_purchase_override)
      }
      if (months_per_coupon_override !== undefined) {
        updates.push(`months_per_coupon_override = $${paramIndex++}`)
        values.push(months_per_coupon_override)
      }

      if (updates.length > 0) {
        values.push(userId)
        await query(
          `UPDATE user_coupon_allocations SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
          values
        )
      }
    }

    res.json({ success: true, message: 'User coupon allocation updated' })
  } catch (error) {
    console.error('Update user coupon allocation error:', error)
    res.status(500).json({ error: 'Failed to update coupon allocation' })
  }
})

/**
 * DELETE /api/admin/users/:id
 * Delete a user and all their data (GDPR compliance)
 */
router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Prevent admin from deleting themselves
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
    }

    // Check if user exists
    const userCheck = await query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedUser = userCheck.rows[0];

    // Delete user (CASCADE will delete related data: subscriptions, workspaces, refresh_tokens, etc.)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    console.log(`Admin ${req.user!.email} deleted user ${deletedUser.email} (ID: ${userId})`);

    res.json({ 
      success: true, 
      message: `User ${deletedUser.email} and all associated data deleted successfully` 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/users/:id/stats', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Get user's workspace data size and last usage
    const workspaceResult = await query(
      `SELECT 
        LENGTH(encrypted_data) as data_size,
        updated_at as last_usage
       FROM workspaces 
       WHERE user_id = $1`,
      [userId]
    );

    // Get last login
    const userResult = await query(
      `SELECT last_login_at 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const workspace = workspaceResult.rows[0] || null;
    const user = userResult.rows[0];

    res.json({
      encrypted_data_size: workspace ? parseInt(workspace.data_size) : 0,
      last_usage: workspace?.last_usage || null,
      last_login: user.last_login_at || null,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed payment history for a user (invoices across gateways)
router.get('/users/:id/payments', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Ensure user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BTC Pay invoices (legacy table)
    const btcpayResult = await query(
      `SELECT 
        invoice_id,
        user_id,
        status,
        amount,
        currency,
        plan_type,
        created_at,
        paid_at,
        'btcpay'::text AS payment_method
       FROM btcpay_invoices
       WHERE user_id = $1`,
      [userId]
    );

    // Multi-gateway invoices (btcpay/stripe/paypal)
    const multiResult = await query(
      `SELECT 
        invoice_id,
        user_id,
        status,
        amount,
        currency,
        plan_type,
        created_at,
        paid_at,
        payment_method
       FROM payment_invoices
       WHERE user_id = $1`,
      [userId]
    );

    const rawPayments = [...btcpayResult.rows, ...multiResult.rows];

    // Normalize and sort by created_at (desc)
    const payments = rawPayments
      .map((p) => ({
        invoice_id: p.invoice_id,
        user_id: p.user_id,
        status: p.status,
        amount: typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount,
        currency: p.currency,
        plan_type: p.plan_type,
        payment_method: p.payment_method,
        created_at: p.created_at,
        paid_at: p.paid_at,
      }))
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    // Compute payment aggregates per currency
    const successfulStatuses = new Set([
      'paid',
      'confirmed',
      'InvoicePaymentSettled',
      'InvoiceSettled',
      'InvoiceProcessing',
    ]);

    const totalsByCurrency: Record<string, number> = {};
    for (const p of payments) {
      if (successfulStatuses.has(p.status) && typeof p.amount === 'number') {
        const key = p.currency || 'UNKNOWN';
        totalsByCurrency[key] = (totalsByCurrency[key] || 0) + p.amount;
      }
    }

    const lastPayment = payments.find(
      (p) => p.paid_at || successfulStatuses.has(p.status)
    );

    // Subscription snapshot for extra context
    const subscriptionResult = await query(
      `SELECT plan, status, started_at, expires_at 
       FROM subscriptions 
       WHERE user_id = $1
       ORDER BY updated_at DESC NULLS LAST, started_at DESC NULLS LAST
       LIMIT 1`,
      [userId]
    );

    const subscription = subscriptionResult.rows[0] || null;
    const now = new Date();
    const hasActiveSubscription =
      subscription &&
      subscription.plan === 'premium' &&
      subscription.expires_at &&
      new Date(subscription.expires_at) > now &&
      subscription.status === 'active';

    res.json({
      payments,
      summary: {
        totals_by_currency: totalsByCurrency,
        last_payment_at: lastPayment?.paid_at || lastPayment?.created_at || null,
        last_method: lastPayment?.payment_method || null,
        last_plan_type: lastPayment?.plan_type || null,
        subscription_plan: subscription?.plan || null,
        subscription_status: subscription?.status || null,
        current_expires_at: subscription?.expires_at || null,
        has_active_subscription: !!hasActiveSubscription,
      },
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get coupon usage history for a user
router.get('/users/:id/coupons-used', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Ensure user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const usageResult = await query(
      `SELECT 
        cu.id,
        cu.coupon_id,
        cu.user_id,
        cu.used_at,
        c.code,
        c.discount_percent,
        c.valid_until,
        c.max_uses
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       WHERE cu.user_id = $1
       ORDER BY cu.used_at DESC`,
      [userId]
    );

    const usages = usageResult.rows;

    const totalUsed = usages.length;
    const lastUsage = usages[0] || null;

    // Optional: referral coupon allocation snapshot
    const allocationResult = await query(
      `SELECT allocated_coupons, claimed_coupons 
       FROM user_coupon_allocations 
       WHERE user_id = $1`,
      [userId]
    );

    const allocation = allocationResult.rows[0] || null;

    res.json({
      usages,
      summary: {
        total_used: totalUsed,
        last_code: lastUsage?.code || null,
        last_used_at: lastUsage?.used_at || null,
        referral_allocation: allocation
          ? {
              allocated_coupons: allocation.allocated_coupons,
              claimed_coupons: allocation.claimed_coupons,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get user coupons-used error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard stats
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const [totalUsers, premiumUsers, activeCoupons] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium' AND status = 'active'"),
      query('SELECT COUNT(*) FROM coupons WHERE (valid_until IS NULL OR valid_until > NOW()) AND (max_uses IS NULL OR current_uses < max_uses)'),
    ]);

    res.json({
      total_users: parseInt(totalUsers.rows[0].count),
      premium_users: parseInt(premiumUsers.rows[0].count),
      active_coupons: parseInt(activeCoupons.rows[0].count),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/announcement
 * Get current announcement (admin view with all fields)
 */
router.get('/announcement', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM admin_announcements ORDER BY id DESC LIMIT 1')
    if (result.rows.length === 0) {
      return res.json({ 
        message: '', 
        text_color: '#000000', 
        background_color: '#fef3c7', 
        enabled: false 
      })
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Get announcement error:', error)
    res.status(500).json({ error: 'Failed to get announcement' })
  }
})

/**
 * PUT /api/admin/announcement
 * Update announcement (admin only)
 */
const announcementSchema = z.object({
  message: z.string(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  enabled: z.boolean()
})

router.put('/announcement', async (req: AuthRequest, res) => {
  try {
    const { message, text_color, background_color, enabled } = announcementSchema.parse(req.body)
    
    // Insert new announcement record (keeps history)
    await query(
      `INSERT INTO admin_announcements (message, text_color, background_color, enabled) 
       VALUES ($1, $2, $3, $4)`,
      [message, text_color, background_color, enabled]
    )
    
    res.json({ success: true, message: 'Announcement updated successfully' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    console.error('Update announcement error:', error)
    res.status(500).json({ error: 'Failed to update announcement' })
  }
})

/**
 * GET /api/admin/onboarding-settings
 * Get onboarding settings (admin only)
 */
router.get('/onboarding-settings', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT onboarding_video_url FROM payment_settings WHERE id = 1')
    res.json({
      onboarding_video_url: result.rows[0]?.onboarding_video_url || ''
    })
  } catch (error: any) {
    console.error('Error fetching onboarding settings:', error)
    res.status(500).json({ error: 'Failed to fetch onboarding settings' })
  }
})

/**
 * PUT /api/admin/onboarding-settings
 * Update onboarding settings (admin only)
 */
router.put('/onboarding-settings', async (req: AuthRequest, res) => {
  try {
    const { onboarding_video_url } = req.body
    const url = typeof onboarding_video_url === 'string' ? onboarding_video_url.trim() : ''
    
    await query(
      'UPDATE payment_settings SET onboarding_video_url = $1 WHERE id = 1',
      [url || null]
    )
    
    res.json({ success: true, onboarding_video_url: url })
  } catch (error: any) {
    console.error('Error updating onboarding settings:', error)
    res.status(500).json({ error: 'Failed to update onboarding settings' })
  }
})

/**
 * GET /api/admin/debug-settings
 * Get debug settings (admin only)
 */
router.get('/debug-settings', async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT debug_button_enabled FROM payment_settings WHERE id = 1')
    if (result.rows.length === 0) {
      return res.json({ debug_button_enabled: false })
    }
    res.json(result.rows[0])
  } catch (error: any) {
    console.error('Error fetching debug settings:', error)
    res.status(500).json({ error: 'Failed to fetch debug settings' })
  }
})

/**
 * PUT /api/admin/debug-settings
 * Update debug settings (admin only)
 */
router.put('/debug-settings', async (req: AuthRequest, res) => {
  try {
    const { debug_button_enabled } = req.body
    
    if (typeof debug_button_enabled !== 'boolean') {
      return res.status(400).json({ error: 'debug_button_enabled must be boolean' })
    }
    
    await query(
      'UPDATE payment_settings SET debug_button_enabled = $1 WHERE id = 1',
      [debug_button_enabled]
    )
    
    res.json({ success: true, debug_button_enabled })
  } catch (error: any) {
    console.error('Error updating debug settings:', error)
    res.status(500).json({ error: 'Failed to update debug settings' })
  }
})

/**
 * GET /api/admin/migration-check
 * Check which users still have plaintext data that needs migration
 */
router.get('/migration-check', async (req: AuthRequest, res) => {
  try {
    // Check for users with plaintext notebooks
    let notebooksUsers: number[] = []
    try {
      const result = await query(`
        SELECT DISTINCT user_id FROM notebooks 
        WHERE content IS NOT NULL AND content != ''
      `)
      notebooksUsers = result.rows.map(r => r.user_id)
    } catch (error: any) {
      const code = (error as { code?: string }).code;
      if (code !== '42703' && code !== '42P01') {
        throw error
      }
    }

    // Check for users with plaintext diaries
    let diariesUsers: number[] = []
    try {
      const result = await query(`
        SELECT DISTINCT user_id FROM diary_entries 
        WHERE content IS NOT NULL AND content != ''
      `)
      diariesUsers = result.rows.map(r => r.user_id)
    } catch (error: any) {
      const code = (error as { code?: string }).code;
      if (code !== '42703' && code !== '42P01') {
        throw error
      }
    }

    // Check for users with plaintext archives
    let archivesUsers: number[] = []
    try {
      const result = await query(`
        SELECT DISTINCT user_id FROM archived_tables 
        WHERE table_data IS NOT NULL
      `)
      archivesUsers = result.rows.map(r => r.user_id)
    } catch (error: any) {
      const code = (error as { code?: string }).code;
      if (code !== '42703' && code !== '42P01') {
        throw error
      }
    }

    // Get total counts (propagate DB errors; only schema errors are swallowed above)
    let totalNotebooks: { rows: { count: string }[] }
    let totalDiaries: { rows: { count: string }[] }
    let totalArchives: { rows: { count: string }[] }
    try {
      totalNotebooks = await query(`
        SELECT COUNT(*) as count FROM notebooks 
        WHERE content IS NOT NULL AND content != ''
      `)
    } catch (err) {
      console.error('Migration check: totalNotebooks query failed', err)
      throw err
    }
    try {
      totalDiaries = await query(`
        SELECT COUNT(*) as count FROM diary_entries 
        WHERE content IS NOT NULL AND content != ''
      `)
    } catch (err) {
      console.error('Migration check: totalDiaries query failed', err)
      throw err
    }
    try {
      totalArchives = await query(`
        SELECT COUNT(*) as count FROM archived_tables 
        WHERE table_data IS NOT NULL
      `)
    } catch (err) {
      console.error('Migration check: totalArchives query failed', err)
      throw err
    }

    // Combine all users
    const allUsersSet = new Set([...notebooksUsers, ...diariesUsers, ...archivesUsers])

    res.json({
      usersWithPlaintext: {
        notebooks: notebooksUsers,
        diaries: diariesUsers,
        archives: archivesUsers,
        total: Array.from(allUsersSet)
      },
      totalCounts: {
        notebooks: parseInt(totalNotebooks.rows[0].count),
        diaries: parseInt(totalDiaries.rows[0].count),
        archives: parseInt(totalArchives.rows[0].count)
      },
      summary: {
        usersAffected: allUsersSet.size,
        safeToDropColumns: allUsersSet.size === 0
      }
    })
  } catch (error) {
    console.error('Migration check error:', error)
    res.status(500).json({ error: 'Failed to check migration status' })
  }
})

export default router;

