/**
 * Push recipient edits to shared table (when recipient has edit permission)
 * Used when shared tables are in workspace instead of modal
 * On 409: fetches latest, merges recipient edits, retries once
 */

import { api, VersionConflictError } from './api'
import { fetchSharedTableUpdate, fetchSharedTableForMerge } from './sharedTableRecipientPull'
import { unwrapDEKFromOwner, encryptTableWithDEK } from './sharingCrypto'
import { ensureSharingKeys } from './sharingKeys'

const SHARING_PRIVATE_KEY = 'tigement_sharing_private_key'

export type PushFailureReason = 'missing_meta' | 'missing_keys' | 'crypto' | 'forbidden' | 'no_edit_permission' | 'version_conflict' | 'network'

export interface SharedTableMeta {
  shareId: number
  canEdit: boolean
  ownerEmail: string
  encryptedDek: string
  ownerPublicKey: string
  version: number
}

function mergeRecipientIntoLatest(latest: any, recipient: any): any {
  const latestTasks = latest?.tasks ?? []
  const recipientTasks = recipient?.tasks ?? []
  const merged = latestTasks.map((t: any) => {
    const r = recipientTasks.find((x: any) => x.id === t.id)
    return r ?? t
  })
  for (const r of recipientTasks) {
    if (!merged.some((t: any) => t.id === r.id)) merged.push(r)
  }
  return { ...latest, tasks: merged, title: recipient?.title ?? latest?.title, date: recipient?.date ?? latest?.date, startTime: recipient?.startTime ?? latest?.startTime }
}

export async function pushSharedTableToShare(
  table: { id: string; _shared?: SharedTableMeta } & Record<string, unknown>
): Promise<{ success: boolean; newVersion?: number; mergedTable?: any; reason?: PushFailureReason }> {
  const meta = table._shared
  if (!meta?.canEdit || !meta.encryptedDek || !meta.ownerPublicKey) {
    return { success: false, reason: 'missing_meta' }
  }

  let privKey = localStorage.getItem(SHARING_PRIVATE_KEY)
  if (!privKey) {
    try {
      const { privateKeyBase64 } = await ensureSharingKeys()
      privKey = privateKeyBase64
    } catch {
      console.warn('Recipient sync: Sharing key not found')
      return { success: false, reason: 'missing_keys' }
    }
  }

  const tryPush = async (toPush: Record<string, unknown>, version: number) => {
    let dek: Uint8Array
    try {
      dek = await unwrapDEKFromOwner(
        meta!.encryptedDek,
        meta!.ownerPublicKey,
        privKey!
      )
    } catch (e) {
      const cryptoErr = new Error('RECIPIENT_PUSH_CRYPTO_FAILED')
      ;(cryptoErr as any).cause = e
      throw cryptoErr
    }
    let encrypted: string
    try {
      encrypted = await encryptTableWithDEK(toPush, dek)
    } catch (e) {
      const cryptoErr = new Error('RECIPIENT_PUSH_CRYPTO_FAILED')
      ;(cryptoErr as any).cause = e
      throw cryptoErr
    }
    return api.updateShareData(meta!.shareId, encrypted, version)
  }

  const { _shared: _omit, ...tableToPush } = table as Record<string, unknown>
  try {
    const { version } = await tryPush(tableToPush, meta.version + 1)
    return { success: true, newVersion: version }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const is409 = err instanceof VersionConflictError || msg.includes('Version conflict') || msg.includes('409')
    if (is409) {
      const currentVersion = err instanceof VersionConflictError ? err.currentVersion : undefined
      const staleThreshold = (currentVersion ?? meta.version) - 1
      let latest = await fetchSharedTableUpdate(meta.shareId, staleThreshold)
      if (!latest) {
        latest = await fetchSharedTableUpdate(meta.shareId, 0)
      }
      if (!latest) {
        latest = await fetchSharedTableForMerge(meta.shareId)
      }
      if (!latest) {
        const retryVersion = (currentVersion ?? meta.version) + 1
        try {
          const { version } = await tryPush(tableToPush, retryVersion)
          return { success: true, newVersion: version }
        } catch {
          console.warn('Recipient sync: Version conflict – could not fetch latest')
          return { success: false, reason: 'version_conflict' }
        }
      }
      let toPush = mergeRecipientIntoLatest(latest.table, table)
      let retryVersion = currentVersion != null ? currentVersion + 1 : latest.version + 1
      const maxRetries = 2
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { version } = await tryPush(toPush, retryVersion)
          return { success: true, newVersion: version, mergedTable: toPush }
        } catch (retryErr: unknown) {
          const rv = retryErr instanceof VersionConflictError ? retryErr.currentVersion : undefined
          if (attempt < maxRetries && (retryErr instanceof VersionConflictError || String(retryErr).includes('409'))) {
            const refreshed = await fetchSharedTableUpdate(meta.shareId, retryVersion - 1)
            if (refreshed) {
              toPush = mergeRecipientIntoLatest(refreshed.table, table)
              retryVersion = (rv ?? refreshed.version) + 1
              continue
            }
          }
          console.warn('Recipient sync: Retry failed:', retryErr)
          return { success: false, reason: 'version_conflict' }
        }
      }
      return { success: false, reason: 'version_conflict' }
    }
    const is403 = msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')
    const isCrypto = msg === 'RECIPIENT_PUSH_CRYPTO_FAILED'
    console.warn('Recipient sync failed:', err)
    if (msg.includes('No edit permission')) return { success: false, reason: 'no_edit_permission' }
    if (is403) return { success: false, reason: 'forbidden' }
    if (isCrypto) return { success: false, reason: 'crypto' }
    return { success: false, reason: 'network' }
  }
}
