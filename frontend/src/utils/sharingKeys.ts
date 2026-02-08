/**
 * Shared utility for ensuring E2EE sharing keys exist (used by Share and Shared with me)
 */

import { generateKeyPair } from './sharingCrypto'
import { api } from './api'

const SHARING_PRIVATE_KEY = 'tigement_sharing_private_key'
const SHARING_PUBLIC_KEY = 'tigement_sharing_public_key'

export async function ensureSharingKeys(): Promise<{ publicKeyBase64: string; privateKeyBase64: string }> {
  const stored = localStorage.getItem(SHARING_PRIVATE_KEY)
  if (stored) {
    const pub = localStorage.getItem(SHARING_PUBLIC_KEY)
    if (pub) {
      await api.setSharingPublicKey(pub).catch(() => {})
      return { publicKeyBase64: pub, privateKeyBase64: stored }
    }
  }
  const { publicKeyBase64, privateKeyBase64 } = await generateKeyPair()
  localStorage.setItem(SHARING_PRIVATE_KEY, privateKeyBase64)
  localStorage.setItem(SHARING_PUBLIC_KEY, publicKeyBase64)
  await api.setSharingPublicKey(publicKeyBase64)
  return { publicKeyBase64, privateKeyBase64 }
}
