/**
 * Shared tables sync for owners (pull-only)
 * Merges recipient edits from shared_tables into owner's workspace.
 * Owner pushes only via Push button (pushOwnerTableToShare).
 */

import { api, VersionConflictError } from './api'
import { encryptionKeyManager } from './encryptionKey'
import {
  decryptTableWithDEK,
  encryptTableWithDEK,
  unwrapDEKForOwner,
} from './sharingCrypto'

/** Merge owner INTO latest - for owner push retry (owner wins on conflict) */
function mergeOwnerIntoLatest(latest: any, owner: any): any {
  const latestTasks = latest?.tasks ?? []
  const ownerTasks = owner?.tasks ?? []
  const merged = latestTasks.map((t: any) => {
    const r = ownerTasks.find((x: any) => x.id === t.id)
    return r ?? t
  })
  for (const r of ownerTasks) {
    if (!merged.some((t: any) => t.id === r.id)) merged.push(r)
  }
  return { ...latest, tasks: merged, title: owner?.title ?? latest?.title, date: owner?.date ?? latest?.date, startTime: owner?.startTime ?? latest?.startTime }
}

/** Merge share (recipient's pushed data) INTO owner - for owner pull (share wins on conflict) */
function mergeShareIntoOwner(shareData: any, owner: any): any {
  const shareTasks = shareData?.tasks ?? []
  const ownerTasks = owner?.tasks ?? []
  const merged = shareTasks.map((t: any) => t)
  for (const r of ownerTasks) {
    if (!merged.some((t: any) => t.id === r.id)) merged.push(r)
  }
  return { ...shareData, tasks: merged, title: owner?.title ?? shareData?.title, date: owner?.date ?? shareData?.date, startTime: owner?.startTime ?? shareData?.startTime }
}

export async function pushOwnerTableToShare(
  table: any,
  onSuccess?: () => void
): Promise<boolean> {
  const encKey = encryptionKeyManager.getKey()
  if (!encKey) return false
  const tryPush = async (toPush: Record<string, unknown>, share: any) => {
    const dek = await unwrapDEKForOwner(share.wrapped_dek_for_owner, encKey)
    const encrypted = await encryptTableWithDEK(toPush, dek)
    return api.updateShareData(share.id, encrypted, share.version + 1)
  }
  try {
    const { shares } = await api.getOwnedShares()
    const share = (shares || []).find((s: any) => s.source_table_id === table.id)
    if (!share?.wrapped_dek_for_owner) return false
    const { _shared: _omit, ...tableToPush } = table as Record<string, unknown>
    await tryPush(tableToPush, share)
    onSuccess?.()
    return true
  } catch (err: any) {
    if (err?.message?.includes('Version conflict') || err instanceof VersionConflictError) {
      const currentVersion = err instanceof VersionConflictError ? err.currentVersion : undefined
      const { shares } = await api.getOwnedShares()
      const share = (shares || []).find((s: any) => s.source_table_id === table.id)
      if (!share?.wrapped_dek_for_owner) return false
      const dek = await unwrapDEKForOwner(share.wrapped_dek_for_owner, encKey)
      const decrypted = await decryptTableWithDEK(share.encrypted_table_data, dek)
      const merged = mergeOwnerIntoLatest(decrypted, table)
      const retryVersion = currentVersion != null ? currentVersion + 1 : (share.version ?? 0) + 1
      try {
        const encrypted = await encryptTableWithDEK(merged, dek)
        await api.updateShareData(share.id, encrypted, retryVersion)
        onSuccess?.()
        return true
      } catch (retryErr) {
        console.warn('Owner push retry failed:', retryErr)
        return false
      }
    }
    console.warn('Failed to push owner table:', table.id, err)
    return false
  }
}

export async function syncSharedTablesForOwner(
  localTables: any[],
  onTablesUpdated: (mergedTables: any[]) => void,
  options?: { preferOwnerLocal?: boolean }
): Promise<void> {
  const encKey = encryptionKeyManager.getKey()
  if (!encKey) return

  // When preferOwnerLocal: we just pushed, owner's data is source of truth; merge keeps owner's tasks.
  // When false: we pulled, recipient edits in share may be newer; merge incorporates them.
  const preferOwner = options?.preferOwnerLocal ?? false

  try {
    const { shares } = await api.getOwnedShares()
    if (!shares?.length) return

    const tableById = new Map(localTables.map((t) => [t.id, t]))
    let merged = [...localTables]
    let hasChanges = false

    for (const share of shares) {
      if (!share.wrapped_dek_for_owner || !share.encrypted_table_data) continue
      const sourceId = String(share.source_table_id)
      const existing = tableById.get(sourceId)
      try {
        const dek = await unwrapDEKForOwner(share.wrapped_dek_for_owner, encKey)
        const decryptedTable = await decryptTableWithDEK(share.encrypted_table_data, dek)
        const { _shared: _omit, ...tableData } = decryptedTable as Record<string, unknown>
        if (existing) {
          const mergedTable = preferOwner
            ? mergeOwnerIntoLatest(tableData, existing)
            : mergeShareIntoOwner(tableData, existing)
          merged = merged.map((t) =>
            t.id === sourceId ? { ...mergedTable, id: sourceId, position: existing.position, size: existing.size, spaceId: existing.spaceId } : t
          )
          hasChanges = true
        } else {
          merged = [...merged, { ...tableData, id: sourceId, position: { x: 20 + merged.length * 100, y: 20 + merged.length * 50 } } as any]
          hasChanges = true
        }
      } catch {
        // Skip shares we can't decrypt
      }
    }

    if (hasChanges && onTablesUpdated) {
      onTablesUpdated(merged)
    }
  } catch (err) {
    console.warn('Shared tables sync failed:', err)
  }
}

/** Fetch owned share update (decrypted) for owner pull. Returns null if no share or decrypt fails. */
export async function fetchOwnedShareUpdate(
  sourceTableId: string
): Promise<{ table: any; version: number; lastPushedByEmail?: string } | null> {
  const encKey = encryptionKeyManager.getKey()
  if (!encKey) return null
  try {
    const { shares } = await api.getOwnedShares()
    const share = (shares || []).find((s: any) => String(s.source_table_id) === sourceTableId)
    if (!share?.wrapped_dek_for_owner || !share.encrypted_table_data) return null
    const dek = await unwrapDEKForOwner(share.wrapped_dek_for_owner, encKey)
    const table = await decryptTableWithDEK(share.encrypted_table_data, dek)
    return {
      table: table as any,
      version: share.version ?? 1,
      lastPushedByEmail: share.last_pushed_by_email,
    }
  } catch {
    return null
  }
}

/** Fetch pending pushes for owner conflict resolution. Returns decrypted pushes with table data. */
export async function fetchOwnedSharePushes(
  sourceTableId: string
): Promise<Array<{ userEmail: string; userId: number; table: any }> | null> {
  const encKey = encryptionKeyManager.getKey()
  if (!encKey) return null
  try {
    const { shares } = await api.getOwnedShares()
    const share = (shares || []).find((s: any) => String(s.source_table_id) === sourceTableId)
    if (!share?.wrapped_dek_for_owner) return null
    const { pushes } = await api.getSharePushes(share.id)
    if (!pushes?.length) return []
    const dek = await unwrapDEKForOwner(share.wrapped_dek_for_owner, encKey)
    const byUser = new Map<number, { userEmail: string; userId: number; table: any }>()
    for (const p of pushes) {
      try {
        const table = await decryptTableWithDEK(p.encrypted_table_data, dek)
        byUser.set(p.user_id, {
          userEmail: p.user_email ?? `User ${p.user_id}`,
          userId: p.user_id,
          table: table as any,
        })
      } catch {
        // Skip pushes we can't decrypt
      }
    }
    return Array.from(byUser.values())
  } catch {
    return null
  }
}
