/**
 * Encryption Key Management
 * Handles storing and retrieving the encryption key for E2EE sync
 * 
 * Storage strategy:
 * - Uses localStorage for persistence across tab suspensions (mobile)
 * - In-memory cache for performance
 * - Cleared on explicit logout, not on browser close
 */

const ENCRYPTION_KEY_STORAGE_KEY = 'tigement_encryption_key'
const CUSTOM_KEY_FLAG_KEY = 'tigement_custom_key_flag'

// In-memory cache for the key (faster access, survives tab suspension)
let keyCache: string | null = null

export const encryptionKeyManager = {
  /**
   * Set the encryption key (from login password or custom key)
   */
  setKey(key: string): void {
    // Store in both memory and localStorage
    keyCache = key
    try {
      // Use localStorage instead of sessionStorage for mobile compatibility
      // Mobile browsers may clear sessionStorage when tab is suspended
      localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, key)
    } catch (error) {
      console.error('Failed to store encryption key:', error)
    }
  },

  /**
   * Get the current encryption key
   */
  getKey(): string | null {
    // Try memory cache first (fastest)
    if (keyCache) {
      return keyCache
    }
    
    // Fall back to localStorage
    try {
      const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY)
      if (stored) {
        // Restore to cache
        keyCache = stored
        return stored
      }
    } catch (error) {
      console.error('Failed to retrieve encryption key:', error)
    }
    
    return null
  },

  /**
   * Clear the encryption key (on logout)
   */
  clearKey(): void {
    keyCache = null
    try {
      localStorage.removeItem(ENCRYPTION_KEY_STORAGE_KEY)
      localStorage.removeItem(CUSTOM_KEY_FLAG_KEY)
    } catch (error) {
      console.error('Failed to clear encryption key:', error)
    }
  },

  /**
   * Check if encryption key is set
   */
  hasKey(): boolean {
    return !!this.getKey()
  },

  /**
   * Set a custom encryption key (for advanced users)
   * This allows using a different key than the login password
   */
  setCustomKey(customKey: string): void {
    if (customKey.length < 8) {
      throw new Error('Encryption key must be at least 8 characters')
    }
    this.setKey(customKey)
    // Mark that a custom key is being used
    try {
      localStorage.setItem(CUSTOM_KEY_FLAG_KEY, 'true')
    } catch (error) {
      console.error('Failed to set custom key flag:', error)
    }
  },

  /**
   * Check if currently using a custom key (vs login password)
   */
  isUsingCustomKey(): boolean {
    try {
      return localStorage.getItem(CUSTOM_KEY_FLAG_KEY) === 'true'
    } catch {
      return false
    }
  },

  /**
   * Revert to using login password for encryption
   * This will use the password from next login
   */
  revertToLoginPassword(): void {
    try {
      localStorage.removeItem(CUSTOM_KEY_FLAG_KEY)
    } catch (error) {
      console.error('Failed to revert to login password:', error)
    }
    // Note: Key itself will be reset on next login
  }
}

