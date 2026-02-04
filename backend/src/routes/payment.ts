/**
 * Payment Routes - Multi-gateway payment processing
 */

import express, { Request, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { adminMiddleware } from '../middleware/admin'
import { createInvoice, verifyWebhookSignature, getPlans } from '../services/btcpay'
import { createCheckoutSession as createStripeSession, constructWebhookEvent } from '../services/stripe'
import { createOrder as createPayPalOrder } from '../services/paypal'
import { query } from '../db'

const router = express.Router()

/**
 * GET /api/payment/plans
 * Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await getPlans()
    const monthly = plans.premium_monthly?.amount || 9.99
    const halfYearly = (monthly * 6 * 0.85) // Calculated: 15% discount
    const yearly = plans.premium_yearly?.amount || 99.99
    
    res.json({
      monthly,
      halfYearly,
      yearly,
      currency: plans.premium_monthly?.currency || 'USD'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get plans' })
  }
})

/**
 * POST /api/payment/validate-coupon
 * Validate a coupon code and return discount info
 */
router.post('/validate-coupon', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }

    // Get coupon from database
    const couponResult = await query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`,
      [code]
    )

    if (couponResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid coupon code' })
    }

    const coupon = couponResult.rows[0]

    // Check if coupon is expired
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    // Check if coupon has reached max uses
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: 'Coupon has reached maximum uses' })
    }

    // Check if user has already used this coupon
    const usageResult = await query(
      `SELECT * FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2`,
      [coupon.id, req.user!.id]
    )

    if (usageResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already used this coupon' })
    }

    res.json({
      valid: true,
      discount_percent: coupon.discount_percent,
      code: coupon.code
    })
  } catch (error: any) {
    console.error('Validate coupon error:', error)
    res.status(500).json({ error: 'Failed to validate coupon' })
  }
})

/**
 * POST /api/payment/activate-free
 * Activate premium for free (100% coupon)
 */
router.post('/activate-free', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { planType, couponCode } = req.body
    const userId = req.user!.id
    const userEmail = req.user!.email

    if (!planType || !['monthly', 'half-yearly', 'yearly'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' })
    }

    if (!couponCode) {
      return res.status(400).json({ error: 'Coupon code is required for free activation' })
    }

    // Validate coupon
    const couponResult = await query(
      `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`,
      [couponCode]
    )

    if (couponResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid coupon code' })
    }

    const coupon = couponResult.rows[0]

    // Verify it's 100% discount
    if (coupon.discount_percent !== 100) {
      return res.status(400).json({ error: 'This endpoint is only for 100% discount coupons' })
    }

    // Check coupon validity
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return res.status(400).json({ error: 'Coupon has reached maximum uses' })
    }

    // Check if user already used this coupon
    const usageResult = await query(
      `SELECT * FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2`,
      [coupon.id, userId]
    )

    if (usageResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already used this coupon' })
    }

    // Calculate subscription duration
    let durationDays: number
    if (planType === 'monthly') {
      durationDays = 30
    } else if (planType === 'half-yearly') {
      durationDays = 180
    } else if (planType === 'yearly') {
      durationDays = 365
    } else {
      durationDays = 30
    }

    // Check if subscription exists and get current expiration
    const existingSubscription = await query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    )

    console.log('Activate-free subscription lookup:', {
      userId,
      planType,
      durationDays,
      hasExisting: existingSubscription.rows.length > 0,
      existingRow: existingSubscription.rows[0] || null,
    })

    let expiresAt: Date
    if (existingSubscription.rows.length > 0 && existingSubscription.rows[0].expires_at) {
      const currentExpiry = new Date(existingSubscription.rows[0].expires_at)
      const now = new Date()
      
      // If current expiration is in the future, extend from that date
      // Otherwise, extend from now
      const baseDate = currentExpiry > now ? currentExpiry : now
      expiresAt = new Date(baseDate)
      expiresAt.setDate(expiresAt.getDate() + durationDays)
      
      console.log('Activate-free extending existing subscription:', {
        userId,
        planType,
        durationDays,
        currentExpiry,
        baseDate,
        newExpiry: expiresAt,
      })
      
      // Update existing subscription
      await query(
        'UPDATE subscriptions SET plan = $1, status = $2, expires_at = $3, updated_at = NOW() WHERE user_id = $4',
        ['premium', 'active', expiresAt, userId]
      )
    } else {
      // New subscription - set expiration from now
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + durationDays)
      
      console.log('Activate-free creating new subscription:', {
        userId,
        planType,
        durationDays,
        newExpiry: expiresAt,
      })
      
      await query(
        `INSERT INTO subscriptions (user_id, plan, status, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET plan = EXCLUDED.plan,
             status = EXCLUDED.status,
             expires_at = EXCLUDED.expires_at,
             updated_at = NOW()`,
        [userId, 'premium', 'active', expiresAt]
      )
    }

    // Track coupon usage
    await query(
      `INSERT INTO coupon_usage (coupon_id, user_id) VALUES ($1, $2)`,
      [coupon.id, userId]
    )

    await query(
      `UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1`,
      [coupon.id]
    )

    console.log(`✅ Premium activated for free for user ${userId} (${userEmail}) until ${expiresAt} using 100% coupon`)

    res.json({
      success: true,
      plan: 'premium',
      expiresAt,
      message: 'Premium activated successfully!'
    })
  } catch (error: any) {
    console.error('Activate free premium error:', error)
    res.status(500).json({ error: error.message || 'Failed to activate premium' })
  }
})

/**
 * POST /api/payment/create-invoice
 * Create a new BTC Pay invoice for subscription
 */
router.post('/create-invoice', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { planType, couponCode } = req.body

    if (!planType || !['monthly', 'half-yearly', 'yearly'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' })
    }

    const userId = req.user!.id
    const userEmail = req.user!.email

    // Validate and apply coupon if provided
    let discountPercent = 0
    let couponId: number | null = null

    if (couponCode) {
      const couponResult = await query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`,
        [couponCode]
      )

      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0]
        
        // Check validity
        const isValid = 
          (!coupon.valid_until || new Date(coupon.valid_until) >= new Date()) &&
          (!coupon.max_uses || coupon.current_uses < coupon.max_uses)

        // Check if user hasn't used it
        const usageResult = await query(
          `SELECT * FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2`,
          [coupon.id, userId]
        )

        if (isValid && usageResult.rows.length === 0) {
          discountPercent = coupon.discount_percent
          couponId = coupon.id
        }
      }
    }

    // Map frontend plan names to backend plan names
    // Note: half-yearly is treated as monthly for invoice creation
    const planMapping: { [key: string]: 'premium_monthly' | 'premium_yearly' } = {
      'monthly': 'premium_monthly',
      'half-yearly': 'premium_monthly', // Use monthly as base
      'yearly': 'premium_yearly'
    }
    
    const backendPlanType = planMapping[planType]

    // Get base price
    const plans = await getPlans()
    const plan = plans[backendPlanType as keyof typeof plans]
    
    // Calculate final amount with discount
    let amount = plan?.amount
    let duration = plan?.duration
    
    if (!amount && planType === 'half-yearly') {
      amount = (plans.premium_monthly?.amount || 9.99) * 6 * 0.85 // 15% discount
      duration = 180 // days
    }

    // Apply coupon discount
    const finalAmount = amount! * (1 - discountPercent / 100)

    // Create invoice in BTC Pay with discounted price
    const invoice = await createInvoice(userId, userEmail, backendPlanType, finalAmount)

    // Save invoice to database
    await query(
      `INSERT INTO btcpay_invoices (user_id, invoice_id, status, amount, currency, plan_type, checkout_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '1 hour')`,
      [userId, invoice.id, invoice.status, finalAmount, plan?.currency || 'USD', planType, invoice.checkoutLink]
    )

    // Track coupon usage if coupon was applied
    if (couponId) {
      await query(
        `INSERT INTO coupon_usage (coupon_id, user_id) VALUES ($1, $2)`,
        [couponId, userId]
      )
      
      // Increment coupon usage count
      await query(
        `UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1`,
        [couponId]
      )
    }

    res.json({
      invoiceId: invoice.id,
      checkoutUrl: invoice.checkoutLink,
      amount: invoice.amount,
      currency: invoice.currency,
      discountApplied: discountPercent > 0 ? discountPercent : undefined
    })
  } catch (error: any) {
    console.error('Create invoice error:', error)
    res.status(500).json({ error: error.message || 'Failed to create invoice' })
  }
})

/**
 * POST /api/payment/webhook
 * Handle BTC Pay Server webhook notifications
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['btcpay-sig'] as string
    
    // Ensure we have a Buffer and convert to string
    let payload: string
    if (Buffer.isBuffer(req.body)) {
      payload = req.body.toString('utf8')
    } else if (typeof req.body === 'string') {
      payload = req.body
    } else {
      console.error('Unexpected body type:', typeof req.body, req.body)
      return res.status(400).json({ error: 'Invalid payload format' })
    }

    // Webhook received successfully

    // Verify webhook signature
    if (!(await verifyWebhookSignature(payload, signature))) {
      console.error('Invalid webhook signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const event = JSON.parse(payload)
    const invoiceId = event.invoiceId
    const eventType = event.type // BTCPay event type
    
    console.log('=== BTCPay Webhook Details ===')
    console.log(`Event Type: ${eventType}`)
    console.log(`Invoice ID: ${invoiceId}`)
    console.log(`Full event data:`, JSON.stringify(event, null, 2))

    // Handle test webhooks from BTCPay
    if (invoiceId.startsWith('__test__')) {
      console.log('✅ Test webhook received and verified successfully')
      return res.status(200).json({ success: true, message: 'Test webhook received' })
    }

    // Get invoice from database (BTCPay legacy table first, then multi-gateway table)
    let invoiceResult = await query(
      'SELECT * FROM btcpay_invoices WHERE invoice_id = $1',
      [invoiceId]
    )

    if (invoiceResult.rows.length === 0) {
      console.warn('Invoice not found in btcpay_invoices, trying payment_invoices...', { invoiceId })

      const fallbackResult = await query(
        'SELECT * FROM payment_invoices WHERE invoice_id = $1 AND payment_method = $2',
        [invoiceId, 'btcpay']
      )

      if (fallbackResult.rows.length === 0) {
        console.error('Invoice not found in either btcpay_invoices or payment_invoices:', invoiceId)
        return res.status(404).json({ error: 'Invoice not found' })
      }

      invoiceResult = fallbackResult
    }

    const invoice = invoiceResult.rows[0]

    // Check if payment is confirmed (BTCPay sends different event types)
    const paymentConfirmed = [
      'InvoicePaymentSettled',  // Main event when payment is confirmed
      'InvoiceProcessing',       // Payment received, processing
      'InvoiceSettled'           // Older BTCPay versions
    ].includes(eventType)

    console.log(`Payment confirmed: ${paymentConfirmed}`)
    console.log(`Current invoice status in DB: ${invoice.status}`)

    // Check if this invoice has already been processed (idempotency)
    const alreadyProcessed = invoice.paid_at !== null || 
      ['InvoicePaymentSettled', 'InvoiceProcessing', 'InvoiceSettled'].includes(invoice.status)

    if (alreadyProcessed && paymentConfirmed) {
      console.log(`⏭️  Invoice ${invoiceId} already processed. Skipping duplicate webhook.`)
      return res.json({ received: true, message: 'Already processed' })
    }

    // Update invoice status in database
    if (paymentConfirmed) {
      await query(
        'UPDATE btcpay_invoices SET status = $1, paid_at = NOW() WHERE invoice_id = $2',
        [eventType, invoiceId]
      )
    } else {
      await query(
        'UPDATE btcpay_invoices SET status = $1 WHERE invoice_id = $2',
        [eventType, invoiceId]
      )
    }

    // If payment is confirmed, activate premium
    if (paymentConfirmed) {
      // Calculate subscription duration based on plan type
      let durationDays: number
      
      if (invoice.plan_type === 'monthly') {
        durationDays = 30
      } else if (invoice.plan_type === 'half-yearly') {
        durationDays = 180
      } else if (invoice.plan_type === 'yearly') {
        durationDays = 365
      } else {
        // Fallback: try to get from plans
        const plans = await getPlans()
        const plan = plans[invoice.plan_type as keyof typeof plans]
        durationDays = plan?.duration || 30
      }

      // Check if subscription exists and get current expiration
      const existingSubscription = await query(
        'SELECT * FROM subscriptions WHERE user_id = $1',
        [invoice.user_id]
      )

      console.log('BTCPay subscription lookup:', {
        userId: invoice.user_id,
        planType: invoice.plan_type,
        durationDays,
        hasExisting: existingSubscription.rows.length > 0,
        existingRow: existingSubscription.rows[0] || null,
      })

      let expiresAt: Date
      if (existingSubscription.rows.length > 0 && existingSubscription.rows[0].expires_at) {
        const currentExpiry = new Date(existingSubscription.rows[0].expires_at)
        const now = new Date()
        
        // If current expiration is in the future, extend from that date
        // Otherwise, extend from now
        const baseDate = currentExpiry > now ? currentExpiry : now
        expiresAt = new Date(baseDate)
        expiresAt.setDate(expiresAt.getDate() + durationDays)
        
        console.log('Extending premium for user (BTCPay):', {
          userId: invoice.user_id,
          planType: invoice.plan_type,
          durationDays,
          currentExpiry,
          baseDate,
          newExpiry: expiresAt,
        })
        
        // Update existing subscription
        await query(
          'UPDATE subscriptions SET plan = $1, status = $2, expires_at = $3, updated_at = NOW() WHERE user_id = $4',
          ['premium', 'active', expiresAt, invoice.user_id]
        )
      } else {
        // New subscription - set expiration from now
        expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + durationDays)
        
        console.log('Creating new premium subscription (BTCPay):', {
          userId: invoice.user_id,
          planType: invoice.plan_type,
          durationDays,
          newExpiry: expiresAt,
        })
        
        await query(
          `INSERT INTO subscriptions (user_id, plan, status, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
           SET plan = EXCLUDED.plan,
               status = EXCLUDED.status,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()`,
          [invoice.user_id, 'premium', 'active', expiresAt]
        )
      }

      console.log(`✅ Premium activated for user ${invoice.user_id} until ${expiresAt}`)
    } else {
      console.log(`⏳ Payment not yet confirmed. Event type: ${eventType}`)
    }

    res.json({ received: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * POST /api/payment/stripe-webhook
 * Handle Stripe webhook notifications
 */
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string
    
    if (!signature) {
      console.error('Missing Stripe signature header')
      return res.status(400).json({ error: 'Missing signature' })
    }

    // Get raw body as Buffer
    let payload: Buffer
    if (Buffer.isBuffer(req.body)) {
      payload = req.body
    } else {
      console.error('Unexpected body type:', typeof req.body)
      return res.status(400).json({ error: 'Invalid payload format' })
    }

    // Verify webhook signature and construct event
    let event
    try {
      event = await constructWebhookEvent(payload, signature)
    } catch (error: any) {
      console.error('Invalid Stripe webhook signature:', error.message)
      return res.status(401).json({ error: 'Invalid signature' })
    }

    console.log('=== Stripe Webhook Details ===')
    console.log(`Event Type: ${event.type}`)
    console.log(`Event ID: ${event.id}`)
    console.log(`Full event data:`, JSON.stringify(event, null, 2))

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      const sessionId = session.id
      const paymentStatus = session.payment_status
      const status = session.status

      console.log(`Session ID: ${sessionId}`)
      console.log(`Payment Status: ${paymentStatus}`)
      console.log(`Session Status: ${status}`)

      // Only process if payment is actually paid and session is complete
      if (paymentStatus !== 'paid' || status !== 'complete') {
        console.log(`⏳ Payment not yet complete. Payment status: ${paymentStatus}, Session status: ${status}`)
        return res.json({ received: true, message: 'Payment not yet complete' })
      }

      // Get invoice from database using session ID
      const invoiceResult = await query(
        'SELECT * FROM payment_invoices WHERE invoice_id = $1 AND payment_method = $2',
        [sessionId, 'stripe']
      )

      if (invoiceResult.rows.length === 0) {
        console.error('Invoice not found for session:', sessionId)
        return res.status(404).json({ error: 'Invoice not found' })
      }

      const invoice = invoiceResult.rows[0]

      // Check if this invoice has already been processed (idempotency)
      // But we still need to ensure the subscription is updated
      const alreadyProcessed = invoice.paid_at !== null
      
      if (!alreadyProcessed) {
        // Update invoice status in database
        await query(
          'UPDATE payment_invoices SET status = $1, paid_at = NOW() WHERE invoice_id = $2',
          ['paid', sessionId]
        )
      } else {
        console.log(`⏭️  Invoice ${sessionId} already marked as paid. Checking subscription status...`)
      }

      // Calculate subscription duration based on plan type
      let durationDays: number
      
      if (invoice.plan_type === 'monthly') {
        durationDays = 30
      } else if (invoice.plan_type === 'half-yearly') {
        durationDays = 180
      } else if (invoice.plan_type === 'yearly') {
        durationDays = 365
      } else {
        // Fallback: try to get from plans
        const plans = await getPlans()
        const plan = plans[invoice.plan_type as keyof typeof plans]
        durationDays = plan?.duration || 30
      }

      // Check if subscription exists and get current expiration
      const existingSubscription = await query(
        'SELECT * FROM subscriptions WHERE user_id = $1',
        [invoice.user_id]
      )

      console.log('Stripe subscription lookup:', {
        userId: invoice.user_id,
        planType: invoice.plan_type,
        durationDays,
        hasExisting: existingSubscription.rows.length > 0,
        existingRow: existingSubscription.rows[0] || null,
      })

      let expiresAt: Date
      const now = new Date()
      
      if (existingSubscription.rows.length > 0) {
        // Update existing subscription
        const existing = existingSubscription.rows[0]
        const currentExpiry = existing.expires_at ? new Date(existing.expires_at) : null
        
        // If current expiration is in the future, extend from that date
        // Otherwise, extend from now
        const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now
        expiresAt = new Date(baseDate)
        expiresAt.setDate(expiresAt.getDate() + durationDays)
        
        console.log('Extending premium for user (Stripe):', {
          userId: invoice.user_id,
          planType: invoice.plan_type,
          durationDays,
          currentExpiry: currentExpiry || null,
          baseDate,
          newExpiry: expiresAt,
        })
        
        // Update existing subscription
        await query(
          'UPDATE subscriptions SET plan = $1, status = $2, expires_at = $3, updated_at = NOW() WHERE user_id = $4',
          ['premium', 'active', expiresAt, invoice.user_id]
        )
      } else {
        // New subscription - set expiration from now
        expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + durationDays)
        
        console.log('Creating new premium subscription (Stripe):', {
          userId: invoice.user_id,
          planType: invoice.plan_type,
          durationDays,
          newExpiry: expiresAt,
        })
        
        await query(
          `INSERT INTO subscriptions (user_id, plan, status, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
           SET plan = EXCLUDED.plan,
               status = EXCLUDED.status,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()`,
          [invoice.user_id, 'premium', 'active', expiresAt]
        )
      }

      console.log(`✅ Premium activated for user ${invoice.user_id} until ${expiresAt} via Stripe`)
    } else {
      console.log(`ℹ️  Unhandled Stripe event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error: any) {
    console.error('Stripe webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

/**
 * GET /api/payment/status/:invoiceId
 * Check payment status
 */
router.get('/status/:invoiceId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params
    const userId = req.user!.id

    let result = await query(
      'SELECT * FROM btcpay_invoices WHERE invoice_id = $1 AND user_id = $2',
      [invoiceId, userId]
    )

    if (result.rows.length === 0) {
      // Support invoices created via multi-gateway endpoint (payment_invoices)
      const fallback = await query(
        'SELECT * FROM payment_invoices WHERE invoice_id = $1 AND user_id = $2',
        [invoiceId, userId]
      )

      if (fallback.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      result = fallback
    }

    const invoice = result.rows[0]

    res.json({
      invoiceId: invoice.invoice_id,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      planType: invoice.plan_type,
      createdAt: invoice.created_at,
      paidAt: invoice.paid_at,
      expiresAt: invoice.expires_at
    })
  } catch (error: any) {
    console.error('Get invoice status error:', error)
    res.status(500).json({ error: 'Failed to get invoice status' })
  }
})

/**
 * GET /api/payment/methods
 * Get enabled payment methods
 */
router.get('/methods', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM payment_methods WHERE enabled = true ORDER BY display_order ASC, id ASC'
    )
    res.json(result.rows)
  } catch (error: any) {
    console.error('Get payment methods error:', error)
    res.status(500).json({ error: 'Failed to get payment methods' })
  }
})

/**
 * POST /api/payment/create-invoice-multi
 * Create invoice for any payment gateway
 */
router.post('/create-invoice-multi', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { planType, paymentMethod, couponCode } = req.body

    if (!planType || !['monthly', 'half-yearly', 'yearly'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' })
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' })
    }

    const userId = req.user!.id
    const userEmail = req.user!.email

    // Get payment method details
    const methodResult = await query(
      'SELECT * FROM payment_methods WHERE method_name = $1 AND enabled = true',
      [paymentMethod]
    )

    if (methodResult.rows.length === 0) {
      return res.status(400).json({ error: 'Payment method not available' })
    }

    const method = methodResult.rows[0]

    // Get base price
    const plans = await getPlans()
    const planMapping: { [key: string]: 'premium_monthly' | 'premium_yearly' } = {
      'monthly': 'premium_monthly',
      'half-yearly': 'premium_monthly',
      'yearly': 'premium_yearly'
    }
    
    const backendPlanType = planMapping[planType]
    const plan = plans[backendPlanType as keyof typeof plans]
    
    let amount = plan?.amount || 9.99
    if (planType === 'half-yearly') {
      amount = (plans.premium_monthly?.amount || 9.99) * 6 * 0.85
    }

    // Apply coupon discount
    let couponId: number | null = null
    if (couponCode) {
      const couponResult = await query(
        `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)`,
        [couponCode]
      )

      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0]
        const isValid = 
          (!coupon.valid_until || new Date(coupon.valid_until) >= new Date()) &&
          (!coupon.max_uses || coupon.current_uses < coupon.max_uses)

        const usageResult = await query(
          `SELECT * FROM coupon_usage WHERE coupon_id = $1 AND user_id = $2`,
          [coupon.id, userId]
        )

        if (isValid && usageResult.rows.length === 0) {
          amount = amount * (1 - coupon.discount_percent / 100)
          couponId = coupon.id
        }
      }
    }

    // Apply payment method discount
    if (method.discount_percent > 0) {
      amount = amount * (1 - method.discount_percent / 100)
    } else if (method.discount_amount > 0) {
      amount = amount - method.discount_amount
    }

    amount = Math.max(0, amount)

    // Create invoice based on payment method
    let invoice: any
    let invoiceId: string
    let checkoutUrl: string

    if (paymentMethod === 'btcpay') {
      invoice = await createInvoice(userId, userEmail, backendPlanType, amount)
      invoiceId = invoice.id
      checkoutUrl = invoice.checkoutLink
    } else if (paymentMethod === 'stripe') {
      invoice = await createStripeSession(
        userId,
        userEmail,
        backendPlanType,
        amount
      )
      invoiceId = invoice.sessionId
      checkoutUrl = invoice.url || ''
    } else if (paymentMethod === 'paypal') {
      invoice = await createPayPalOrder(
        userId,
        userEmail,
        backendPlanType,
        amount
      )
      invoiceId = invoice.id
      checkoutUrl = invoice.checkoutUrl || ''
    } else {
      return res.status(400).json({ error: 'Unsupported payment method' })
    }

    // Save invoice to database
    const stripePaymentIntentId = paymentMethod === 'stripe' && invoice.paymentIntentId ? invoice.paymentIntentId : null
    await query(
      `INSERT INTO payment_invoices (user_id, invoice_id, status, amount, currency, plan_type, checkout_url, payment_method, stripe_payment_intent_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 hour')`,
      [userId, invoiceId, invoice.status || 'new', amount, plan?.currency || 'USD', planType, checkoutUrl, paymentMethod, stripePaymentIntentId]
    )

    // Track coupon usage if applied
    if (couponId) {
      await query(
        `INSERT INTO coupon_usage (coupon_id, user_id) VALUES ($1, $2)`,
        [couponId, userId]
      )
      await query(
        `UPDATE coupons SET current_uses = current_uses + 1 WHERE id = $1`,
        [couponId]
      )
    }

    res.json({
      invoiceId,
      id: invoiceId,
      checkoutUrl,
      amount,
      currency: plan?.currency || 'USD'
    })
  } catch (error: any) {
    console.error('Create invoice multi error:', error)
    res.status(500).json({ error: error.message || 'Failed to create invoice' })
  }
})

export default router

