/**
 * OAuth key choice: use secure key stored in provider (Google/GitHub/Microsoft) or use own passphrase.
 * Handles new user (generate + upload), returning with provider key (handled in App), and migration (verify + upload).
 */

import { useState } from 'react'
import { api } from '../../utils/api'
import { encryptionKeyManager } from '../../utils/encryptionKey'
import { readKeyFromProvider, writeKeyToProvider } from '../../utils/providerKeyStorage'

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft'
}

export interface OAuthKeyChoiceDialogProps {
  oauthToken: string
  provider: string
  hasPassphrase: boolean
  onChoosePassphrase: () => void
  onComplete: () => void
  onError: (message: string) => void
  onClose: () => void
}

export function OAuthKeyChoiceDialog({
  oauthToken,
  provider,
  hasPassphrase,
  onChoosePassphrase,
  onComplete,
  onError,
  onClose
}: OAuthKeyChoiceDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [migrationPassphrase, setMigrationPassphrase] = useState('')
  const [step, setStep] = useState<'choice' | 'migration'>('choice')

  const providerName = PROVIDER_NAMES[provider] || provider

  const runProviderKeyFlow = async (keyToStore: string) => {
    setError('')
    setLoading(true)
    try {
      const { provider: p, accessToken } = await api.getOAuthProviderToken(oauthToken)
      await writeKeyToProvider(p, accessToken, keyToStore)
      const response = await api.completeOAuthWithProviderKey(oauthToken)
      api.setTokens(response.accessToken, response.refreshToken)
      encryptionKeyManager.setKey(keyToStore)
      onComplete()
    } catch (err: any) {
      const msg = err?.message || 'Failed to use secure key'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleUseSecureKeyNew = async () => {
    setError('')
    setLoading(true)
    try {
      const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      await runProviderKeyFlow(key)
    } catch (err: any) {
      const msg = err?.message || 'Failed to set up secure key'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleMigrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (migrationPassphrase.length < 8) {
      setError('Passphrase must be at least 8 characters')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.verifyOAuthPassphrase(oauthToken, migrationPassphrase)
      await runProviderKeyFlow(migrationPassphrase)
    } catch (err: any) {
      const msg = err?.message || 'Invalid passphrase or failed to move key'
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'migration') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-[450px] max-h-[90vh] overflow-y-auto">
          <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h2 className="text-xl font-bold">Move key to {providerName}</h2>
            <button type="button" onClick={() => setStep('choice')} className="text-2xl hover:text-gray-300 transition" disabled={loading}>
              &times;
            </button>
          </div>
          <form onSubmit={handleMigrationSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-700">
              Enter your current passphrase once. It will be stored in your {providerName} account so you won&apos;t need to enter it again on this device or others.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current passphrase</label>
              <input
                type="password"
                value={migrationPassphrase}
                onChange={(e) => setMigrationPassphrase(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4fc3f7] text-white py-3 rounded font-medium hover:bg-[#3ba3d7] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Moving...' : 'Move to ' + providerName}
            </button>
            <button type="button" onClick={() => setStep('choice')} disabled={loading} className="w-full text-gray-600 py-2 text-sm hover:text-gray-800">
              Back
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[450px] max-h-[90vh] overflow-y-auto">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Encryption key</h2>
          <button type="button" onClick={onClose} className="text-2xl hover:text-gray-300 transition" disabled={loading}>
            &times;
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Choose how to protect your synced data:
          </p>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
            <p className="font-semibold mb-1">Using {providerName} to store your key</p>
            <p>
              The key will be stored in your {providerName} account. {providerName} could read it. Your data on Tigement&apos;s servers remains encrypted and private.
            </p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={hasPassphrase ? () => setStep('migration') : handleUseSecureKeyNew}
            disabled={loading}
            className="w-full bg-[#4fc3f7] text-white py-3 rounded font-medium hover:bg-[#3ba3d7] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Please wait...' : hasPassphrase ? `Move key to ${providerName}` : `Use secure key in ${providerName}`}
          </button>
          <button
            type="button"
            onClick={onChoosePassphrase}
            disabled={loading}
            className="w-full border border-gray-300 text-gray-700 py-3 rounded font-medium hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Use my own passphrase
          </button>
          <button type="button" onClick={onClose} disabled={loading} className="w-full text-gray-600 py-2 text-sm hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
