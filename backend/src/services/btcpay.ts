/**
 * BTC Pay Server Integration
 * Handles invoice creation and webhook processing
 */

import axios from 'axios'
import crypto from 'crypto'
import { query } from '../db'

// Get payment settings from database
async function getPaymentSettings() {
  const result = await query('SELECT * FROM payment_settings WHERE id = 1')
  if (result.rows.length === 0) {
    throw new Error('Payment settings not configured')
  }
  return result.rows[0]
}

// Get pricing plans from database
async function getPlans() {
  const settings = await getPaymentSettings()
  return {
    premium_monthly: {
      amount: parseFloat(settings.premium_monthly_price),
      currency: settings.currency,
      duration: 30,
      name: 'Premium Monthly'
    },
    premium_yearly: {
      amount: parseFloat(settings.premium_yearly_price),
      currency: settings.currency,
      duration: 365,
      name: 'Premium Yearly'
    }
  }
}

export interface BTCPayInvoice {
  id: string
  checkoutLink: string
  status: string
  amount: string
  currency: string
}

/**
 * Create a new BTC Pay invoice for subscription
 */
export async function createInvoice(
  userId: number,
  userEmail: string,
  planType: 'premium_monthly' | 'premium_yearly',
  customAmount?: number
): Promise<BTCPayInvoice> {
  const settings = await getPaymentSettings()
  const plans = await getPlans()
  const plan = plans[planType]
  
  if (!plan) {
    throw new Error('Invalid plan type')
  }

  if (!settings.btcpay_url || !settings.btcpay_store_id || !settings.btcpay_api_key) {
    throw new Error('BTC Pay Server not configured. Please configure in admin settings.')
  }

  // Use custom amount if provided (for coupon discounts), otherwise use plan amount
  const amount = customAmount !== undefined ? customAmount : plan.amount

  try {
    const response = await axios.post(
      `${settings.btcpay_url}/api/v1/stores/${settings.btcpay_store_id}/invoices`,
      {
        amount: amount.toFixed(2),
        currency: plan.currency,
        metadata: {
          orderId: `${userId}-${Date.now()}`,
          userId: userId.toString(),
          planType,
          buyerEmail: userEmail
        },
        checkout: {
          // Don't redirect - let user close the tab manually
          // This prevents opening multiple tabs
          redirectAutomatically: false,
          defaultLanguage: 'en-US'
        }
      },
      {
        headers: {
          'Authorization': `token ${settings.btcpay_api_key}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Tigement/1.0'
        }
      }
    )

    return {
      id: response.data.id,
      checkoutLink: response.data.checkoutLink,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency
    }
  } catch (error: any) {
    console.error('BTCPay invoice creation failed:', error.response?.data || error.message)
    throw new Error('Failed to create payment invoice')
  }
}

/**
 * Verify BTCPay webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  const settings = await getPaymentSettings()
  
  if (!settings.btcpay_webhook_secret) {
    console.warn('BTCPay webhook secret not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', settings.btcpay_webhook_secret)
  const expectedSignature = 'sha256=' + hmac.update(payload).digest('hex')
  
  if (signature !== expectedSignature) {
    console.error('❌ Invalid webhook signature')
    return false
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Get invoice status from BTC Pay Server
 */
export async function getInvoiceStatus(invoiceId: string): Promise<string> {
  const settings = await getPaymentSettings()
  
  try {
    const response = await axios.get(
      `${settings.btcpay_url}/api/v1/stores/${settings.btcpay_store_id}/invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `token ${settings.btcpay_api_key}`,
          'User-Agent': 'Tigement/1.0'
        }
      }
    )
    
    return response.data.status
  } catch (error: any) {
    console.error('Failed to get invoice status:', error.response?.data || error.message)
    throw new Error('Failed to get invoice status')
  }
}

export { getPlans }

