/**
 * Email Service
 * Handles sending emails via SMTP (Nodemailer)
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Create reusable transporter
let transporter: Transporter | null = null

export function getTransporter(): Transporter {
  if (transporter) {
    return transporter
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP configuration missing. Please configure SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.')
  }

  console.log(`📧 Configuring SMTP: ${smtpHost}:${smtpPort} (secure: ${smtpPort === 465})`)

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Increase timeout for slow connections
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Add debug logging
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development',
  })

  return transporter
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<void> {
  const transport = getTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  const mailOptions = {
    from: `"Tigement" <${from}>`,
    to: email,
    subject: 'Reset Your Password - Tigement',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #4a6c7a 0%, #5a7c8a 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              background: #4fc3f7;
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
            .button:hover {
              background: #3ba3d7;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 14px;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            
            <p>We received a request to reset the password for your Tigement account associated with <strong>${email}</strong>.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #4fc3f7; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong><br>
              This link will expire in <strong>1 hour</strong> for security reasons.
            </div>
            
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          </div>
          <div class="footer">
            <p>This is an automated email from Tigement Task Management.</p>
            <p>Need help? Contact us at support@tigement.com</p>
          </div>
        </body>
      </html>
    `,
    text: `
Password Reset Request

Hello,

We received a request to reset the password for your Tigement account associated with ${email}.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

---
This is an automated email from Tigement Task Management.
Need help? Contact us at support@tigement.com
    `.trim(),
  }

  try {
    await transport.sendMail(mailOptions)
    console.log(`✅ Password reset email sent to: ${email}`)
  } catch (error) {
    console.error('Failed to send password reset email:', error)
    throw new Error('Failed to send password reset email')
  }
}

