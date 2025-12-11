/**
 * Initialize payment settings from environment variables
 * This runs on startup to populate the database if settings aren't configured
 */

import { query } from './index'

export async function initPaymentSettings(): Promise<void> {
  try {
    // Check if payment settings already have values configured
    const result = await query('SELECT * FROM payment_settings WHERE id = 1')
    
    if (result.rows.length === 0) {
      console.log('⚠️  Payment settings row not found')
      return
    }

    const settings = result.rows[0]
    
    // Check if all payment settings are already configured (don't overwrite existing configs)
    // We'll only update fields that are missing or if env vars are explicitly set

    // Get values from environment
    const {
      BTCPAY_URL,
      BTCPAY_STORE_ID,
      BTCPAY_API_KEY,
      BTCPAY_WEBHOOK_SECRET,
      STRIPE_PUBLIC_KEY,
      STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET,
      PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET,
      PAYPAL_MODE
    } = process.env

    // Check if any env vars are set
    const hasAnyEnvVars = BTCPAY_URL || BTCPAY_STORE_ID || BTCPAY_API_KEY || BTCPAY_WEBHOOK_SECRET ||
                          STRIPE_PUBLIC_KEY || STRIPE_SECRET_KEY || STRIPE_WEBHOOK_SECRET ||
                          PAYPAL_CLIENT_ID || PAYPAL_CLIENT_SECRET

    if (!hasAnyEnvVars) {
      console.log('ℹ️  No payment environment variables found - skipping initialization')
      return
    }

    // Build update query dynamically - only update if env var is set AND database value is empty/null
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (BTCPAY_URL && !settings.btcpay_url) {
      updates.push(`btcpay_url = $${paramIndex++}`)
      values.push(BTCPAY_URL)
    }
    if (BTCPAY_STORE_ID && !settings.btcpay_store_id) {
      updates.push(`btcpay_store_id = $${paramIndex++}`)
      values.push(BTCPAY_STORE_ID)
    }
    if (BTCPAY_API_KEY && !settings.btcpay_api_key) {
      updates.push(`btcpay_api_key = $${paramIndex++}`)
      values.push(BTCPAY_API_KEY)
    }
    if (BTCPAY_WEBHOOK_SECRET && !settings.btcpay_webhook_secret) {
      updates.push(`btcpay_webhook_secret = $${paramIndex++}`)
      values.push(BTCPAY_WEBHOOK_SECRET)
    }
    if (STRIPE_PUBLIC_KEY && !settings.stripe_public_key) {
      updates.push(`stripe_public_key = $${paramIndex++}`)
      values.push(STRIPE_PUBLIC_KEY)
    }
    if (STRIPE_SECRET_KEY && !settings.stripe_secret_key) {
      updates.push(`stripe_secret_key = $${paramIndex++}`)
      values.push(STRIPE_SECRET_KEY)
    }
    if (STRIPE_WEBHOOK_SECRET && !settings.stripe_webhook_secret) {
      updates.push(`stripe_webhook_secret = $${paramIndex++}`)
      values.push(STRIPE_WEBHOOK_SECRET)
    }
    if (PAYPAL_CLIENT_ID && !settings.paypal_client_id) {
      updates.push(`paypal_client_id = $${paramIndex++}`)
      values.push(PAYPAL_CLIENT_ID)
    }
    if (PAYPAL_CLIENT_SECRET && !settings.paypal_client_secret) {
      updates.push(`paypal_client_secret = $${paramIndex++}`)
      values.push(PAYPAL_CLIENT_SECRET)
    }
    if (PAYPAL_MODE && !settings.paypal_mode) {
      updates.push(`paypal_mode = $${paramIndex++}`)
      values.push(PAYPAL_MODE)
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`)
      await query(
        `UPDATE payment_settings 
         SET ${updates.join(', ')}
         WHERE id = 1`,
        values
      )

      console.log('✅ Payment settings initialized from environment variables')
      console.log(`   - BTCPay URL: ${BTCPAY_URL ? '✓' : '✗'}`)
      console.log(`   - BTCPay Store ID: ${BTCPAY_STORE_ID ? '✓' : '✗'}`)
      console.log(`   - BTCPay API Key: ${BTCPAY_API_KEY ? '✓' : '✗'}`)
      console.log(`   - BTCPay Webhook Secret: ${BTCPAY_WEBHOOK_SECRET ? '✓' : '✗'}`)
      console.log(`   - Stripe Public Key: ${STRIPE_PUBLIC_KEY ? '✓' : '✗'}`)
      console.log(`   - Stripe Secret Key: ${STRIPE_SECRET_KEY ? '✓' : '✗'}`)
      console.log(`   - Stripe Webhook Secret: ${STRIPE_WEBHOOK_SECRET ? '✓' : '✗'}`)
      console.log(`   - PayPal Client ID: ${PAYPAL_CLIENT_ID ? '✓' : '✗'}`)
      console.log(`   - PayPal Client Secret: ${PAYPAL_CLIENT_SECRET ? '✓' : '✗'}`)
      console.log(`   - PayPal Mode: ${PAYPAL_MODE || 'sandbox'}`)
    }

  } catch (error) {
    console.error('❌ Failed to initialize payment settings:', error)
    // Don't throw - let the app continue even if this fails
  }
}

