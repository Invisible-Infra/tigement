/**
 * Browser detection utilities for embedded in-app browsers (WebViews).
 * Google blocks OAuth in these browsers (403 disallowed_useragent) because
 * they can intercept communication between the user and Google.
 */

const EMBEDDED_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\[LinkedInApp\]/i, name: 'LinkedIn' },
  { pattern: /\[FBAN\]|\[FBAV\]|\[FB_IAB\]/i, name: 'Facebook' },
  { pattern: /Instagram/i, name: 'Instagram' },
  { pattern: /Snapchat/i, name: 'Snapchat' },
  { pattern: /Line\//i, name: 'Line' },
  { pattern: /Twitter for iPhone|TwitterAndroid/i, name: 'X' },
];

/**
 * Detects if the app is running in an embedded in-app browser (WebView)
 * that Google blocks for OAuth (403 disallowed_useragent).
 */
export function isEmbeddedWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return EMBEDDED_PATTERNS.some(({ pattern }) => pattern.test(ua));
}

/**
 * Returns the detected in-app browser name for personalized messaging,
 * or null if not in an embedded browser or app is unknown.
 */
export function getEmbeddedAppName(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  for (const { pattern, name } of EMBEDDED_PATTERNS) {
    if (pattern.test(ua)) return name;
  }
  return null;
}
