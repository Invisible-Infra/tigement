import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'
import { query } from '../db'

export type TwoFactorVerifyResult =
  | { ok: true; usedBackupCode: boolean }
  | { ok: false; reason: 'not_enabled' | 'no_secret' | 'invalid' | 'invalid_backup' }

function normalizeOtpInput(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim()
}

function normalizeBase32Secret(secret: unknown): string {
  if (secret == null) return ''
  return String(secret).replace(/\s+/g, '').trim().toUpperCase()
}

function parseUserId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export type VerifyTwoFactorOptions = {
  /** When false, backup codes are checked but not marked used (login must verify again with true). */
  consumeBackup?: boolean
}

/**
 * Validates TOTP (6- or 8-digit) or a one-time backup code for a user with 2FA enabled.
 * Used by POST /2fa/validate (consumeBackup: false) and by /auth/login (default true).
 */
export async function verifyTwoFactorForUser(
  userIdRaw: unknown,
  tokenRaw: unknown,
  options: VerifyTwoFactorOptions = {}
): Promise<TwoFactorVerifyResult> {
  const consumeBackup = options.consumeBackup !== false
  const userId = parseUserId(userIdRaw)
  const token = normalizeOtpInput(tokenRaw)
  if (!userId || !token) {
    return { ok: false, reason: 'invalid' }
  }

  const result = await query(
    'SELECT two_factor_secret FROM users WHERE id = $1 AND two_factor_enabled = TRUE',
    [userId]
  )

  const row = result.rows[0]
  if (!row) {
    return { ok: false, reason: 'not_enabled' }
  }

  const secret = normalizeBase32Secret(row.two_factor_secret)
  if (!secret) {
    return { ok: false, reason: 'no_secret' }
  }

  const window = 4

  // Standard 6-digit TOTP
  if (/^\d{6}$/.test(token)) {
    const ok = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window,
      digits: 6,
    })
    if (ok) return { ok: true, usedBackupCode: false }
  }

  // 8-digit TOTP (some authenticator configurations)
  if (/^\d{8}$/.test(token)) {
    const ok8 = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window,
      digits: 8,
    })
    if (ok8) return { ok: true, usedBackupCode: false }
  }

  // Backup codes: 8 chars, base36 (stored uppercase). Run after TOTP so 8-digit codes try TOTP-8 first.
  const looksLikeBackup = token.length === 8 && /^[A-Z0-9]+$/i.test(token)
  if (looksLikeBackup) {
    const backup = token.toUpperCase()
    const backupCodesResult = await query(
      'SELECT id, code_hash FROM backup_codes WHERE user_id = $1 AND used = FALSE',
      [userId]
    )

    for (const backupCode of backupCodesResult.rows) {
      const matches = await bcrypt.compare(backup, backupCode.code_hash)
      if (matches) {
        if (consumeBackup) {
          await query('UPDATE backup_codes SET used = TRUE WHERE id = $1', [backupCode.id])
        }
        return { ok: true, usedBackupCode: true }
      }
    }
    const hadLetter = /[A-Za-z]/.test(token)
    return { ok: false, reason: hadLetter ? 'invalid_backup' : 'invalid' }
  }

  return { ok: false, reason: 'invalid' }
}

/** Used during 2FA setup (secret not yet tied to enabled flag). */
export function verifyTotpAgainstSecret(secretRaw: unknown, tokenRaw: unknown): boolean {
  const secret = normalizeBase32Secret(secretRaw)
  const token = normalizeOtpInput(tokenRaw)
  if (!secret || !token) return false

  const window = 4
  if (/^\d{6}$/.test(token)) {
    if (speakeasy.totp.verify({ secret, encoding: 'base32', token, window, digits: 6 })) return true
  }
  if (/^\d{8}$/.test(token)) {
    if (speakeasy.totp.verify({ secret, encoding: 'base32', token, window, digits: 8 })) return true
  }
  return false
}
