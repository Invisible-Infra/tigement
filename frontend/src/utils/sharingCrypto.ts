/**
 * E2EE table sharing crypto using X25519 ECDH + AES-GCM
 * Server never sees plaintext or Table DEK
 * Uses @noble exclusively; Web Crypto is skipped because SES/lockdown and some
 * environments restrict crypto.subtle (X25519) even when the browser supports it.
 */

const IV_LENGTH = 12
const DEK_LENGTH = 32
const SALT_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 32768
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

// --- Web Crypto implementations (unused; kept for reference; SES restricts crypto.subtle) ---

async function webGenerateKeyPair(): Promise<{ publicKeyBase64: string; privateKeyBase64: string }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits']
  )
  const [pub, priv] = await Promise.all([
    crypto.subtle.exportKey('raw', pair.publicKey),
    crypto.subtle.exportKey('raw', pair.privateKey),
  ])
  return {
    publicKeyBase64: bytesToBase64(new Uint8Array(pub)),
    privateKeyBase64: bytesToBase64(new Uint8Array(priv)),
  }
}

async function webDeriveSharedSecret(
  privateKeyBase64: string,
  otherPublicKeyBase64: string
): Promise<Uint8Array> {
  const raw = base64ToBytes(privateKeyBase64)
  const privKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'X25519' },
    false,
    ['deriveBits']
  )
  const pubRaw = base64ToBytes(otherPublicKeyBase64)
  const pubKey = await crypto.subtle.importKey(
    'raw',
    pubRaw,
    { name: 'X25519' },
    false,
    []
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: pubKey },
    privKey,
    256
  )
  return new Uint8Array(bits)
}

async function webEncryptTableWithDEK(tableData: unknown, dek: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await crypto.subtle.importKey(
    'raw',
    dek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const plaintext = new TextEncoder().encode(JSON.stringify(tableData))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return bytesToBase64(combined)
}

async function webDecryptTableWithDEK(
  encryptedBase64: string,
  dek: Uint8Array
): Promise<unknown> {
  const combined = base64ToBytes(encryptedBase64)
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  const key = await crypto.subtle.importKey(
    'raw',
    dek,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

async function webWrapDEKForRecipient(
  dek: Uint8Array,
  recipientPublicKeyBase64: string,
  ownerPrivateKeyBase64: string
): Promise<string> {
  const sharedSecret = await webDeriveSharedSecret(
    ownerPrivateKeyBase64,
    recipientPublicKeyBase64
  )
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dek
  )
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return bytesToBase64(combined)
}

async function webUnwrapDEKFromOwner(
  encryptedDekBase64: string,
  ownerPublicKeyBase64: string,
  recipientPrivateKeyBase64: string
): Promise<Uint8Array> {
  const sharedSecret = await webDeriveSharedSecret(
    recipientPrivateKeyBase64,
    ownerPublicKeyBase64
  )
  const combined = base64ToBytes(encryptedDekBase64)
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  const key = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const dek = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new Uint8Array(dek)
}

async function webWrapDEKForOwner(dek: Uint8Array, encryptionKey: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const aesKey = await crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    dek
  )
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  return bytesToBase64(combined)
}

async function webUnwrapDEKForOwner(
  encryptedBase64: string,
  encryptionKey: string
): Promise<Uint8Array> {
  const combined = base64ToBytes(encryptedBase64)
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const aesKey = await crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  const dek = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  )
  return new Uint8Array(dek)
}

// --- Noble fallback implementations ---

async function nobleGenerateKeyPair(): Promise<{ publicKeyBase64: string; privateKeyBase64: string }> {
  const { x25519 } = await import('@noble/curves/ed25519.js')
  const priv = x25519.utils.randomPrivateKey()
  const pub = x25519.getPublicKey(priv)
  return {
    publicKeyBase64: bytesToBase64(pub),
    privateKeyBase64: bytesToBase64(priv),
  }
}

async function nobleDeriveSharedSecret(
  privateKeyBase64: string,
  otherPublicKeyBase64: string
): Promise<Uint8Array> {
  const { x25519 } = await import('@noble/curves/ed25519.js')
  const priv = base64ToBytes(privateKeyBase64)
  const pub = base64ToBytes(otherPublicKeyBase64)
  return x25519.getSharedSecret(priv, pub)
}

async function nobleEncryptTableWithDEK(tableData: unknown, dek: Uint8Array): Promise<string> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const { randomBytes } = await import('@noble/ciphers/utils.js')
  const iv = randomBytes(IV_LENGTH)
  const plaintext = new TextEncoder().encode(JSON.stringify(tableData))
  const aes = gcm(dek, iv)
  const ciphertext = aes.encrypt(plaintext)
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)
  return bytesToBase64(combined)
}

async function nobleDecryptTableWithDEK(
  encryptedBase64: string,
  dek: Uint8Array
): Promise<unknown> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const combined = base64ToBytes(encryptedBase64)
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  const aes = gcm(dek, iv)
  const decrypted = aes.decrypt(ciphertext)
  return JSON.parse(new TextDecoder().decode(decrypted))
}

async function nobleWrapDEKForRecipient(
  dek: Uint8Array,
  recipientPublicKeyBase64: string,
  ownerPrivateKeyBase64: string
): Promise<string> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const { randomBytes } = await import('@noble/ciphers/utils.js')
  const sharedSecret = await nobleDeriveSharedSecret(
    ownerPrivateKeyBase64,
    recipientPublicKeyBase64
  )
  const iv = randomBytes(IV_LENGTH)
  const aes = gcm(sharedSecret, iv)
  const ciphertext = aes.encrypt(dek)
  const combined = new Uint8Array(iv.length + ciphertext.length)
  combined.set(iv)
  combined.set(ciphertext, iv.length)
  return bytesToBase64(combined)
}

async function nobleUnwrapDEKFromOwner(
  encryptedDekBase64: string,
  ownerPublicKeyBase64: string,
  recipientPrivateKeyBase64: string
): Promise<Uint8Array> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const sharedSecret = await nobleDeriveSharedSecret(
    recipientPrivateKeyBase64,
    ownerPublicKeyBase64
  )
  const combined = base64ToBytes(encryptedDekBase64)
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  const aes = gcm(sharedSecret, iv)
  return aes.decrypt(ciphertext)
}

async function nobleWrapDEKForOwner(dek: Uint8Array, encryptionKey: string): Promise<string> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const { randomBytes } = await import('@noble/ciphers/utils.js')
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = await nobleDeriveKeyPBKDF2(new TextEncoder().encode(encryptionKey), salt)
  const aes = gcm(key, iv)
  const ciphertext = aes.encrypt(dek)
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.length)
  combined.set(salt)
  combined.set(iv, salt.length)
  combined.set(ciphertext, salt.length + iv.length)
  return bytesToBase64(combined)
}

async function nobleUnwrapDEKForOwner(
  encryptedBase64: string,
  encryptionKey: string
): Promise<Uint8Array> {
  const { gcm } = await import('@noble/ciphers/aes.js')
  const combined = base64ToBytes(encryptedBase64)
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)
  const key = await nobleDeriveKeyPBKDF2(new TextEncoder().encode(encryptionKey), salt)
  const aes = gcm(key, iv)
  return aes.decrypt(ciphertext)
}

async function nobleDeriveKeyPBKDF2(
  password: Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  const { pbkdf2Async } = await import('@noble/hashes/pbkdf2.js')
  const { sha256 } = await import('@noble/hashes/sha256.js')
  return pbkdf2Async(sha256, password, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  })
}

// --- Public API (always uses @noble; avoids SES/lockdown crypto.subtle restrictions) ---

export async function generateKeyPair(): Promise<{ publicKeyBase64: string; privateKeyBase64: string }> {
  return nobleGenerateKeyPair()
}

export async function deriveSharedSecret(
  privateKeyBase64: string,
  otherPublicKeyBase64: string
): Promise<Uint8Array> {
  return nobleDeriveSharedSecret(privateKeyBase64, otherPublicKeyBase64)
}

export async function encryptTableWithDEK(
  tableData: unknown,
  dek: Uint8Array
): Promise<string> {
  return nobleEncryptTableWithDEK(tableData, dek)
}

export async function decryptTableWithDEK(
  encryptedBase64: string,
  dek: Uint8Array
): Promise<unknown> {
  return nobleDecryptTableWithDEK(encryptedBase64, dek)
}

export function generateTableDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_LENGTH))
}

export async function wrapDEKForRecipient(
  dek: Uint8Array,
  recipientPublicKeyBase64: string,
  ownerPrivateKeyBase64: string
): Promise<string> {
  return nobleWrapDEKForRecipient(dek, recipientPublicKeyBase64, ownerPrivateKeyBase64)
}

export async function unwrapDEKFromOwner(
  encryptedDekBase64: string,
  ownerPublicKeyBase64: string,
  recipientPrivateKeyBase64: string
): Promise<Uint8Array> {
  return nobleUnwrapDEKFromOwner(encryptedDekBase64, ownerPublicKeyBase64, recipientPrivateKeyBase64)
}

export async function wrapDEKForOwner(dek: Uint8Array, encryptionKey: string): Promise<string> {
  return nobleWrapDEKForOwner(dek, encryptionKey)
}

export async function unwrapDEKForOwner(
  encryptedBase64: string,
  encryptionKey: string
): Promise<Uint8Array> {
  return nobleUnwrapDEKForOwner(encryptedBase64, encryptionKey)
}
