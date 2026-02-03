/**
 * Onboarding storage keys and helpers.
 * Keys follow project convention: tigement_ prefix.
 */

const SEEN_KEY = 'tigement_onboarding_seen_v1'
const NEVER_SHOW_KEY = 'tigement_onboarding_neverShow'

export function getOnboardingSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

export function setOnboardingSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'true')
  } catch {
    // ignore
  }
}

export function getOnboardingNeverShow(): boolean {
  try {
    return localStorage.getItem(NEVER_SHOW_KEY) === 'true'
  } catch {
    return false
  }
}

export function setOnboardingNeverShow(): void {
  try {
    localStorage.setItem(NEVER_SHOW_KEY, 'true')
  } catch {
    // ignore
  }
}

export function clearOnboardingSeen(): void {
  try {
    localStorage.removeItem(SEEN_KEY)
  } catch {
    // ignore
  }
}

export function clearOnboardingNeverShow(): void {
  try {
    localStorage.removeItem(NEVER_SHOW_KEY)
  } catch {
    // ignore
  }
}

/** Clears seen only - next app load will show modal (unless neverShow is true) */
export function resetOnboarding(): void {
  clearOnboardingSeen()
}

/** Clears both seen and neverShow - re-enables full onboarding flow */
export function enableOnboardingAgain(): void {
  clearOnboardingSeen()
  clearOnboardingNeverShow()
}
