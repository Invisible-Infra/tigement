/**
 * Client-side encryption utilities using Web Crypto API
 * Provides AES-GCM encryption/decryption for workspace data
 */

const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_LENGTH = 256
const ITERATIONS = 100000

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt workspace data
 * @param data - Any data structure (will be JSON stringified)
 * @param password - User password for encryption
 * @returns Base64 encoded encrypted string with salt and IV prepended
 */
export async function encryptWorkspace(data: any, password: string): Promise<string> {
  try {
    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // Derive key
    const key = await deriveKey(password, salt)

    // Convert data to JSON and then to buffer
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(JSON.stringify(data))

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    )

    // Combine salt + IV + encrypted data
    const combined = new Uint8Array(
      SALT_LENGTH + IV_LENGTH + encrypted.byteLength
    )
    combined.set(salt, 0)
    combined.set(iv, SALT_LENGTH)
    combined.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH)

    // Build binary string in chunks to avoid "too many function arguments" (engine limit ~65536)
    const CHUNK = 32768
    let binary = ''
    for (let i = 0; i < combined.length; i += CHUNK) {
      const chunk = combined.subarray(i, i + CHUNK)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    return btoa(binary)
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt workspace data')
  }
}

/**
 * Decrypt workspace data
 * @param encryptedString - Base64 encoded encrypted string
 * @param password - User password for decryption
 * @returns Decrypted data object
 */
export async function decryptWorkspace(encryptedString: string, password: string): Promise<any> {
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0))

    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, SALT_LENGTH)
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH)

    // Derive key
    const key = await deriveKey(password, salt)

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )

    // Convert buffer to string and parse JSON
    const decoder = new TextDecoder()
    const jsonString = decoder.decode(decrypted)
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt workspace data. Invalid password or corrupted data.')
  }
}

/**
 * Test if a password can decrypt the given encrypted data
 */
export async function testPassword(encryptedString: string, password: string): Promise<boolean> {
  try {
    await decryptWorkspace(encryptedString, password)
    return true
  } catch {
    return false
  }
}

