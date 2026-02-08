/**
 * Modal for sharing a table with another user (premium, E2EE)
 */

import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { encryptionKeyManager } from '../utils/encryptionKey'
import { ensureSharingKeys } from '../utils/sharingKeys'
import {
  generateTableDEK,
  encryptTableWithDEK,
  wrapDEKForRecipient,
  wrapDEKForOwner,
  unwrapDEKForOwner,
} from '../utils/sharingCrypto'

interface Recipient {
  userId: number
  email: string
  permission: string
  always_accept_from?: boolean
}

interface OutgoingShare {
  id: number
  source_table_id: string
  recipients: Recipient[]
}

interface ShareTableModalProps {
  table: { id: string; title: string; type: string; date?: string; tasks: any[]; [k: string]: any }
  onClose: () => void
  onSuccess?: () => void
}

export function ShareTableModal({ table, onClose, onSuccess }: ShareTableModalProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingShare, setExistingShare] = useState<OutgoingShare | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(true)
  const [updatingRecipient, setUpdatingRecipient] = useState<number | null>(null)
  const [revokingRecipient, setRevokingRecipient] = useState<number | null>(null)
  const [deletingShare, setDeletingShare] = useState(false)
  const [updatingAlwaysAccept, setUpdatingAlwaysAccept] = useState<number | null>(null)

  const loadExistingShare = async () => {
    setLoadingRecipients(true)
    try {
      const { shares } = await api.getOutgoingShares()
      const share = (shares || []).find((s: OutgoingShare) => s.source_table_id === table.id)
      setExistingShare(share || null)
    } catch {
      setExistingShare(null)
    } finally {
      setLoadingRecipients(false)
    }
  }

  useEffect(() => {
    loadExistingShare()
  }, [table.id])

  const recipients = existingShare?.recipients || []

  const handleShare = async () => {
    const trimEmail = email.trim().toLowerCase()
    if (!trimEmail) {
      setError('Enter recipient email')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { publicKeyBase64: myPub, privateKeyBase64: myPriv } = await ensureSharingKeys()
      await api.setSharingPublicKey(myPub)
      const keyRes = await api.getPublicKeyByEmail(trimEmail)

      let encryptedTableData: string
      let encryptedDek: string
      let wrappedDekForOwner: string | undefined

      if (existingShare) {
        // Adding to existing share: use the SAME DEK that encrypted the table data (unwrap from wrapped_dek_for_owner)
        const encKey = encryptionKeyManager.getKey()
        if (!encKey) {
          setError('Encryption key required to add recipient')
          return
        }
        const { shares } = await api.getOwnedShares()
        const owned = (shares || []).find((s: { source_table_id: string }) => s.source_table_id === table.id)
        if (!owned?.wrapped_dek_for_owner) {
          setError('Cannot add recipient: share key missing')
          return
        }
        const dek = await unwrapDEKForOwner(owned.wrapped_dek_for_owner, encKey)
        encryptedTableData = owned.encrypted_table_data
        encryptedDek = await wrapDEKForRecipient(dek, keyRes.publicKey, myPriv)
        wrappedDekForOwner = owned.wrapped_dek_for_owner
      } else {
        // New share: create new DEK
        const dek = generateTableDEK()
        encryptedTableData = await encryptTableWithDEK(table, dek)
        encryptedDek = await wrapDEKForRecipient(dek, keyRes.publicKey, myPriv)
        const encKey = encryptionKeyManager.getKey()
        wrappedDekForOwner = encKey ? await wrapDEKForOwner(dek, encKey) : undefined
      }

      await api.createShare({
        tableId: table.id,
        recipientEmail: trimEmail,
        permission,
        encryptedTableData,
        encryptedDek,
        wrappedDekForOwner,
      })
      setEmail('')
      await loadExistingShare()
      onSuccess?.()
    } catch (err: any) {
      const isNotSupported =
        err?.name === 'NotSupportedError' ||
        /not supported|operation is not supported/i.test(err?.message || '')
      setError(
        isNotSupported
          ? 'Sharing is not available in this environment (e.g. strict security extensions). Try a different browser or disable extensions.'
          : err.message || 'Failed to share'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePermission = async (recipientId: number, newPermission: 'view' | 'edit') => {
    if (!existingShare) return
    setUpdatingRecipient(recipientId)
    try {
      await api.updateSharePermission(existingShare.id, recipientId, newPermission)
      await loadExistingShare()
    } catch (err: any) {
      setError(err?.message || 'Failed to update permission')
    } finally {
      setUpdatingRecipient(null)
    }
  }

  const handleRevoke = async (recipientId: number) => {
    if (!existingShare) return
    setRevokingRecipient(recipientId)
    try {
      await api.revokeShareRecipient(existingShare.id, recipientId)
      await loadExistingShare()
      onSuccess?.()
    } catch (err: any) {
      setError(err?.message || 'Failed to remove recipient')
    } finally {
      setRevokingRecipient(null)
    }
  }

  const handleStopSharing = async () => {
    if (!existingShare || !confirm('Stop sharing this table? Recipients will lose access.')) return
    setDeletingShare(true)
    try {
      await api.deleteShare(existingShare.id)
      setExistingShare(null)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to stop sharing')
    } finally {
      setDeletingShare(false)
    }
  }

  const handleAlwaysAcceptToggle = async (recipientId: number, enabled: boolean) => {
    if (!existingShare) return
    setUpdatingAlwaysAccept(recipientId)
    try {
      await api.updateShareRecipientAlwaysAccept(existingShare.id, recipientId, enabled)
      await loadExistingShare()
    } catch (err: any) {
      setError(err?.message || 'Failed to update setting')
    } finally {
      setUpdatingAlwaysAccept(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">Share &quot;{table.title}&quot;</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>
        <div className="p-6 overflow-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permission
              </label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              >
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <button
              onClick={handleShare}
              disabled={loading}
              className="w-full px-4 py-2 bg-[#4a6c7a] text-white rounded hover:bg-[#3d5d6a] disabled:opacity-50"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {recipients.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Shared with:
                </p>
                <ul className="space-y-2">
                  {recipients.map((r) => (
                    <li
                      key={r.userId}
                      className="flex items-center gap-2 flex-wrap text-gray-700"
                    >
                      <span className="flex-1 min-w-0 truncate text-sm">{r.email}</span>
                      <select
                        value={r.permission}
                        onChange={(e) => handleUpdatePermission(r.userId, e.target.value as 'view' | 'edit')}
                        disabled={updatingRecipient === r.userId}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                      >
                        <option value="view">View only</option>
                        <option value="edit">Can edit</option>
                      </select>
                      {r.permission === 'edit' && (
                        <label className="flex items-center gap-1 text-sm cursor-pointer" title="Skip preview modal when pulling changes from this user">
                          <input
                            type="checkbox"
                            checked={!!r.always_accept_from}
                            onChange={(e) => handleAlwaysAcceptToggle(r.userId, e.target.checked)}
                            disabled={updatingAlwaysAccept === r.userId}
                          />
                          <span>Always accept</span>
                        </label>
                      )}
                      <button
                        onClick={() => handleRevoke(r.userId)}
                        disabled={revokingRecipient === r.userId}
                        className="px-2 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50"
                      >
                        {revokingRecipient === r.userId ? 'Removing...' : 'Remove'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-between mt-6">
            {existingShare && (
              <button
                onClick={handleStopSharing}
                disabled={deletingShare}
                className="px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingShare ? 'Stopping...' : 'Stop sharing'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
