/**
 * Environment variable helpers with validation.
 * Use these instead of process.env.X! to get clear errors when required vars are missing.
 */

export function getJwtSecret(): string {
  const v = process.env.JWT_SECRET;
  if (!v || !v.trim()) {
    throw new Error('JWT_SECRET is required and must be non-empty. Set it in .env or environment.');
  }
  return v;
}

export function getJwtRefreshSecret(): string {
  const v = process.env.JWT_REFRESH_SECRET;
  if (!v || !v.trim()) {
    throw new Error('JWT_REFRESH_SECRET is required and must be non-empty. Set it in .env or environment.');
  }
  return v;
}
