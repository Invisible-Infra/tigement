/**
 * Shared with me - tables shared by other users (E2EE)
 */

import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { ensureSharingKeys } from '../utils/sharingKeys'
import { unwrapDEKFromOwner, decryptTableWithDEK } from '../utils/sharingCrypto'

interface DecryptedShare {
  id: number
  owner_email: string
  permission: string
  table: any
  canEdit: boolean
  version: number
  encrypted_dek: string
  owner_public_key: string
}

export interface SharedTableContext {
  formatDate: (d: string) => string
  formatTime: (time24: string) => string
  parseTime: (timeStr: string) => string
  formatDuration: (minutes: number) => string
  parseDuration: (timeStr: string) => number
  getTotalDuration: (table: any) => string
  isTaskInPast: (table: any, endTime: string) => boolean
  isTaskCurrent: (table: any, startTime: string, endTime: string) => boolean
  getTaskTimeMatchStatus: (taskName: string, actualStartTime: string) => 'match' | 'mismatch' | null
  getTaskGroup: (groupId?: string) => any
  getContrastColor: (hexColor?: string) => string
  getEffectiveBackgroundHex: (el: HTMLElement | null) => string
  getThemeColor: (varName: string) => string
  settings: any
  iconMap: Record<string, any>
  taskGroups: any[]
  calculateTimes: (table: any) => { start: string; end: string }[]
}

interface SharedWithMeSectionProps {
  onClose: () => void
  onDuplicateTable?: (table: any) => void
  onAddSharedToWorkspace?: (
    table: any,
    meta: { shareId: number; canEdit: boolean; ownerEmail: string; encryptedDek: string; ownerPublicKey: string; version: number }
  ) => void
  isPremium: boolean
  formatDate: (d: string) => string
  tableContext?: SharedTableContext
}

export function SharedWithMeSection({ onClose, onDuplicateTable, onAddSharedToWorkspace, isPremium, formatDate, tableContext }: SharedWithMeSectionProps) {
  const [shares, setShares] = useState<DecryptedShare[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [decryptFailCount, setDecryptFailCount] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const loadShares = async () => {
    try {
      setError(null)
      setDecryptFailCount(0)
      const { privateKeyBase64: privKey } = await ensureSharingKeys()
      const { shares: raw } = await api.getIncomingShares()
      const decrypted: DecryptedShare[] = []
      let failed = 0
      for (const s of raw) {
        if (!s.owner_public_key) continue
        try {
          const dek = await unwrapDEKFromOwner(s.encrypted_dek, s.owner_public_key, privKey)
          const table = await decryptTableWithDEK(s.encrypted_table_data, dek)
          decrypted.push({
            id: s.id,
            owner_email: s.owner_email || 'Unknown',
            permission: s.permission,
            table,
            canEdit: isPremium && s.permission === 'edit',
            version: s.version ?? 1,
            encrypted_dek: s.encrypted_dek,
            owner_public_key: s.owner_public_key,
          })
        } catch (e) {
          console.warn('Share decrypt failed:', s.id, e)
          failed++
        }
      }
      setDecryptFailCount(failed)
      setShares(decrypted)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
      setShares([])
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await loadShares()
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await loadShares()
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message?.includes('not support') || err?.message?.includes('Operation is not supported')
              ? 'Sharing is not available in this environment. Try a different browser or disable extensions.'
              : err?.message || 'Failed to load shared tables'
          )
          setShares([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isPremium])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">Shared with me</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {loading && <p className="text-gray-700">Loading...</p>}
          {error && (
            <div className="mb-4">
              <p className="text-red-600 mb-2">{error}</p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3d5d6a] disabled:opacity-50"
              >
                {retrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}
          {!loading && decryptFailCount > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
              {decryptFailCount} shared table(s) could not be opened. Ask the owner to remove you from the share and add you again.
            </div>
          )}
          {!loading && !error && shares.some((s) => !s.canEdit && s.permission === 'edit') && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
              Some tables were shared with edit permission, but you have view-only access. Upgrade to premium to edit.
            </div>
          )}
          {!loading && !error && shares.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No tables shared with you yet</p>
              <p className="text-sm text-gray-500 mb-4">
                If you expect shared tables, try refreshing or logging out and back in.
                Ensure your browser supports encryption (Chrome, Firefox, Safari).
              </p>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3d5d6a] disabled:opacity-50"
              >
                {retrying ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          )}
          {!loading && shares.map((s) => (
            <div
              key={s.id}
              className="border border-gray-200 rounded-lg p-4 mb-3 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-700">
                    {s.table?.title || s.table?.name || 'Untitled'}
                  </p>
                  <p className="text-sm text-gray-500">
                    From {s.owner_email} • {s.permission}
                    {!s.canEdit && s.permission === 'edit' && ' (view only – premium required to edit)'}
                  </p>
                  {s.table?.date && (
                    <p className="text-xs text-gray-400 mt-1">{formatDate(s.table.date)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {onAddSharedToWorkspace && (
                    <button
                      onClick={() => {
                        onAddSharedToWorkspace(s.table, {
                          shareId: s.id,
                          canEdit: s.canEdit,
                          ownerEmail: s.owner_email,
                          encryptedDek: s.encrypted_dek,
                          ownerPublicKey: s.owner_public_key,
                          version: s.version,
                        })
                        onClose()
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                    >
                      {s.canEdit ? 'Open / Edit' : 'View'}
                    </button>
                  )}
                  {onDuplicateTable && (
                    <button
                      onClick={() => { onDuplicateTable(s.table); onClose(); }}
                      className="px-3 py-1 bg-[#4a6c7a] text-white rounded text-sm hover:bg-[#3d5d6a]"
                    >
                      Duplicate to my workspace
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!loading && shares.length > 0 && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {retrying ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
