import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../utils/api'
import { loadTables, loadNotebooks, stashAnonDataSnapshot } from '../../utils/storage'
import { OAuthButtons } from './OAuthButtons'

interface LoginFormProps {
  onClose: () => void
  onSwitchToRegister: () => void
  onSwitchToForgotPassword?: () => void
}

export function LoginForm({ onClose, onSwitchToRegister, onSwitchToForgotPassword }: LoginFormProps) {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorToken, setTwoFactorToken] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [trustDevice, setTrustDevice] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Stash anonymous local data BEFORE any login/sync can change storage
      try {
        const anonTables = loadTables()
        const anonNotebooks = loadNotebooks()
        if ((anonTables && anonTables.length) || (anonNotebooks && ((anonNotebooks.workspace?.trim()?.length || 0) > 0 || Object.keys(anonNotebooks.tasks || {}).length > 0))) {
          stashAnonDataSnapshot('pre_login', anonTables, anonNotebooks)
          // Set flag to prevent auto-reload so merge dialog can be shown
          sessionStorage.setItem('tigement_has_merge_data', 'true')
          console.log('🔒 Merge data detected - auto-reload will be skipped')
        }
      } catch {}

      if (requires2FA && userId) {
        // Validate 2FA token
        const validation = await api.validate2FA(userId, twoFactorToken)
        if (!validation.valid) {
          setError('Invalid authentication code')
          setLoading(false)
          return
        }
        // Complete login with 2FA token (with retry on mobile network failure)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await login(email, password, twoFactorToken, trustDevice)
            break
          } catch (e: any) {
            const isNetworkError =
              e?.name === 'TypeError' ||
              e?.name === 'AbortError' ||
              (typeof e?.message === 'string' &&
                (e.message.includes('fetch') || e.message.includes('network') || e.message.toLowerCase().includes('cancelled')))
            if (isNetworkError && attempt === 0) {
              await new Promise(resolve => setTimeout(resolve, 800))
              continue
            }
            throw e
          }
        }
        // Wait for authentication state to update (handle race condition on mobile)
        let attempts = 0
        const maxAttempts = 20 // 2 seconds max wait
        while (!api.getAccessToken() && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        await new Promise(resolve => setTimeout(resolve, 100))
        onClose()
      } else {
        // Initial login attempt (with retry on mobile network failure)
        let lastError: Error | null = null
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await login(email, password)
            lastError = null

            // Check if the response indicates 2FA is required
            if ((response as any)?.requiresTwoFactor) {
              setRequires2FA(true)
              setUserId((response as any).userId)
              setError('')
              break
            }
            // Wait for authentication state to update (handle race condition on mobile)
            let attempts = 0
            const maxAttempts = 20 // 2 seconds max wait
            while (!api.getAccessToken() && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100))
              attempts++
            }
            await new Promise(resolve => setTimeout(resolve, 100))
            onClose()
            break
          } catch (e: any) {
            lastError = e
            const isNetworkError =
              e?.name === 'TypeError' ||
              e?.name === 'AbortError' ||
              (typeof e?.message === 'string' &&
                (e.message.includes('fetch') || e.message.includes('network') || e.message.toLowerCase().includes('cancelled')))
            if (isNetworkError && attempt === 0) {
              await new Promise(resolve => setTimeout(resolve, 800))
              continue
            }
            throw e
          }
        }
        if (lastError) throw lastError
      }
    } catch (err: any) {
      const isNetworkError =
        err?.name === 'TypeError' ||
        err?.name === 'AbortError' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('fetch') || err.message.includes('network') || err.message.toLowerCase().includes('cancelled')))
      setError(isNetworkError ? 'Connection failed. Please check your network and try again.' : (err.message || 'Login failed. Please check your credentials.'))
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[400px] max-h-[80vh] overflow-y-auto">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Login</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {requires2FA && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
              🔐 Two-factor authentication is enabled. Please enter the 6-digit code from your authenticator app.
            </div>
          )}

          {!requires2FA && (
            <>
              {/* OAuth Buttons */}
              <OAuthButtons onLoading={setLoading} onError={setError} />

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or with email</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  placeholder="••••••••"
                />
                {onSwitchToForgotPassword && (
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={onSwitchToForgotPassword}
                      className="text-sm text-[#4fc3f7] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {requires2FA && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authentication Code
                </label>
                <input
                  type="text"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  placeholder="000000"
                  maxLength={8}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 6-digit code from your app, or an 8-character backup code
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="trustDevice"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 text-[#4fc3f7] border-gray-300 rounded focus:ring-[#4fc3f7]"
                />
                <label htmlFor="trustDevice" className="ml-2 text-sm text-gray-700">
                  Trust this browser for 30 days (skip 2FA)
                </label>
              </div>
            </>
          )}


          <div className="flex gap-3 pt-4">
            {requires2FA && (
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false)
                  setUserId(null)
                  setTwoFactorToken('')
                  setError('')
                }}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition"
              >
                Back
              </button>
            )}
            {!requires2FA && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : requires2FA ? 'Verify & Login' : 'Login'}
            </button>
          </div>

          {!requires2FA && (
            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-[#4fc3f7] hover:underline"
              >
                Register here
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

