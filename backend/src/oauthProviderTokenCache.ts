/**
 * Short-lived cache for OAuth provider access tokens.
 * Used so the frontend can exchange the short-lived oauth_token JWT for the
 * provider's access token (one-time) to read/write the sync key in Drive/gist/OneDrive.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface Entry {
  provider: string;
  accessToken: string;
  ts: number;
}

const cache = new Map<number, Entry>();

function cleanup() {
  const now = Date.now();
  for (const [userId, entry] of cache.entries()) {
    if (now - entry.ts > TTL_MS) cache.delete(userId);
  }
}

export function setProviderToken(userId: number, provider: string, accessToken: string): void {
  cleanup();
  cache.set(userId, { provider, accessToken, ts: Date.now() });
}

export function getAndDeleteProviderToken(userId: number): { provider: string; accessToken: string } | null {
  const entry = cache.get(userId);
  cache.delete(userId);
  if (!entry || Date.now() - entry.ts > TTL_MS) return null;
  return { provider: entry.provider, accessToken: entry.accessToken };
}
