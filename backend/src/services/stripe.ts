/**
 * Stripe integration service
 */

import Stripe from 'stripe'
import { query } from '../db'
import { getPlans } from './btcpay'

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2023-10-16'

async function getPaymentSettings() {
  const result = await query('SELECT * FROM payment_settings WHERE id = 1')
  if (result.rows.length === 0) {
    throw new Error('Payment settings not configured')
  }
  return result.rows[0]
}

async function getStripeClient(): Promise<Stripe> {
  const settings = await getPaymentSettings()

  if (!settings.stripe_secret_key) {
    throw new Error('Stripe secret key is not configured')
  }

  return new Stripe(settings.stripe_secret_key, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: 'Tigement',
      version: '1.0.0'
    }
  })
}

export interface StripeCheckoutSession {
  sessionId: string
  url: string
  paymentIntentId?: string
}

export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  planType: 'premium_monthly' | 'premium_yearly',
  customAmount?: number
): Promise<StripeCheckoutSession> {
  const stripe = await getStripeClient()
  const settings = await getPaymentSettings()
  const plans = await getPlans()
  const plan = plans[planType]

  if (!plan) {
    throw new Error('Invalid plan type')
  }

  if (!settings.stripe_public_key) {
    throw new Error('Stripe public key is not configured')
  }

  const amount = customAmount !== undefined ? customAmount : plan.amount
  const unitAmount = Math.round(amount * 100) // convert to cents

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency,
          unit_amount: unitAmount,
          product_data: {
            name: plan.name,
            description: `Tigement ${plan.name}`
          }
        }
      }
    ],
    metadata: {
      userId: userId.toString(),
      planType,
      source: 'tigement_app'
    },
    success_url: `${frontendUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/?payment=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60 // 30 minutes
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  return {
    sessionId: session.id,
    url: session.url,
    paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined
  }
}

export async function constructWebhookEvent(payload: Buffer, signature: string) {
  const stripe = await getStripeClient()
  const settings = await getPaymentSettings()

  if (!settings.stripe_webhook_secret) {
    throw new Error('Stripe webhook secret is not configured')
  }

  return stripe.webhooks.constructEvent(payload, signature, settings.stripe_webhook_secret)
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = await getStripeClient()
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent']
  })
}


