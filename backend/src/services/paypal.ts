/**
 * PayPal Integration Service
 */

import axios from 'axios';
import { query } from '../db';
import { getPlans } from './btcpay';

interface PayPalConfig {
  client_id: string;
  client_secret: string;
  base_url: string;
  webhook_id?: string;
}

let paypalConfig: PayPalConfig | null = null;
let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getPayPalConfigFromDb(): Promise<PayPalConfig> {
  const result = await query(`SELECT config FROM payment_methods WHERE method_name = 'paypal'`);
  if (result.rows.length === 0 || !result.rows[0].config) {
    throw new Error('PayPal not configured');
  }
  const config = result.rows[0].config;
  if (!config.client_id || !config.client_secret || !config.base_url) {
    throw new Error('PayPal client ID, client secret, or base URL missing in config');
  }
  return {
    client_id: config.client_id,
    client_secret: config.client_secret,
    base_url: config.base_url,
    webhook_id: config.webhook_id,
  };
}

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  if (!paypalConfig) {
    paypalConfig = await getPayPalConfigFromDb();
  }

  const auth = Buffer.from(`${paypalConfig.client_id}:${paypalConfig.client_secret}`).toString('base64');
  try {
    const response = await axios.post(
      `${paypalConfig.base_url}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
    return accessToken as string;
  } catch (error: any) {
    console.error('Failed to get PayPal access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with PayPal');
  }
}

export async function createOrder(
  userId: number,
  userEmail: string,
  planType: 'premium_monthly' | 'premium_yearly',
  customAmount?: number
) {
  const token = await getAccessToken();
  if (!paypalConfig) {
    paypalConfig = await getPayPalConfigFromDb();
  }

  const plans = await getPlans();
  const plan = plans[planType];
  const amount = customAmount || plan?.amount || 9.99;
  const currency = plan?.currency || 'USD';

  try {
    const response = await axios.post(
      `${paypalConfig.base_url}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            custom_id: `${userId}-${planType}-${Date.now()}`,
            description: `${planType} Premium Subscription`,
            soft_descriptor: 'TIGEMENTPREM',
          },
        ],
        application_context: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}?payment=success`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}?payment=cancelled`,
          brand_name: 'TIGEMENT',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const approvalLink = response.data.links.find((link: any) => link.rel === 'approve');
    return {
      id: response.data.id,
      status: response.data.status,
      checkoutUrl: approvalLink ? approvalLink.href : null,
    };
  } catch (error: any) {
    console.error('Failed to create PayPal order:', error.response?.data || error.message);
    throw new Error('Failed to create PayPal order');
  }
}

export async function captureOrder(orderId: string) {
  const token = await getAccessToken();
  if (!paypalConfig) {
    paypalConfig = await getPayPalConfigFromDb();
  }

  try {
    const response = await axios.post(
      `${paypalConfig.base_url}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to capture PayPal order:', error.response?.data || error.message);
    throw new Error('Failed to capture PayPal order');
  }
}

export interface PayPalWebhookHeaders extends Record<string, string | undefined> {
  'paypal-transmission-id': string;
  'paypal-transmission-time': string;
  'paypal-transmission-sig': string;
  'paypal-cert-url': string;
  'paypal-auth-algo': string;
}

export async function verifyWebhookSignature(
  body: any,
  headers: PayPalWebhookHeaders
): Promise<boolean> {
  if (!paypalConfig) {
    paypalConfig = await getPayPalConfigFromDb();
  }
  if (!paypalConfig.webhook_id) {
    console.warn('PayPal webhook ID not configured. Skipping signature verification.');
    return false;
  }

  try {
    const response = await axios.post(
      `${paypalConfig.base_url}/v1/notifications/verify-webhook-signature`,
      {
        webhook_id: paypalConfig.webhook_id,
        transmission_id: headers['paypal-transmission-id'],
        transmission_time: headers['paypal-transmission-time'],
        cert_url: headers['paypal-cert-url'],
        auth_algo: headers['paypal-auth-algo'],
        transmission_sig: headers['paypal-transmission-sig'],
        webhook_event: body,
      },
      {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.verification_status === 'SUCCESS';
  } catch (error: any) {
    console.error('PayPal webhook signature verification failed:', error.response?.data || error.message);
    return false;
  }
}
