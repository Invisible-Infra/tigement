/**
 * Fetch share updates for recipient's shared tables in workspace
 * Merges newer share data into local table when share has updated
 */

import { api } from './api'
import { unwrapDEKFromOwner, decryptTableWithDEK } from './sharingCrypto'

const SHARING_PRIVATE_KEY = 'tigement_sharing_private_key'

export interface SharedTableMeta {
  shareId: number
  canEdit: boolean
  ownerEmail: string
  encryptedDek: string
  ownerPublicKey: string
  version: number
}

export async function fetchSharedTableUpdate(
  shareId: number,
  currentVersion: number
): Promise<{ table: any; version: number } | null> {
  const privKey = localStorage.getItem(SHARING_PRIVATE_KEY)
  if (!privKey) return null

  try {
    const { shares } = await api.getIncomingShares()
    const share = (shares || []).find((s: any) => s.id === shareId)
    if (!share?.owner_public_key || !share.encrypted_table_data) return null
    const shareVersion = share.version ?? 0
    if (shareVersion <= currentVersion) return null

    const dek = await unwrapDEKFromOwner(
      share.encrypted_dek,
      share.owner_public_key,
      privKey
    )
    const table = await decryptTableWithDEK(share.encrypted_table_data, dek)
    return { table: table as any, version: share.version ?? currentVersion }
  } catch {
    return null
  }
}

/** Fetches latest share data for merge (no version check). Used when fetchSharedTableUpdate returns null on 409 retry. */
export async function fetchSharedTableForMerge(
  shareId: number
): Promise<{ table: any; version: number } | null> {
  const privKey = localStorage.getItem(SHARING_PRIVATE_KEY)
  if (!privKey) return null

  try {
    const { shares } = await api.getIncomingShares()
    const share = (shares || []).find((s: any) => s.id === shareId)
    if (!share?.owner_public_key || !share.encrypted_table_data) return null

    const dek = await unwrapDEKFromOwner(
      share.encrypted_dek,
      share.owner_public_key,
      privKey
    )
    const table = await decryptTableWithDEK(share.encrypted_table_data, dek)
    return { table: table as any, version: share.version ?? 0 }
  } catch {
    return null
  }
}
