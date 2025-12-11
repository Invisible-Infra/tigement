import { useState, useEffect } from 'react'
import { api } from '../../utils/api'

interface ResetPasswordFormProps {
  token: string
  onSuccess: () => void
}

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    // Validate password match
    if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
    } else {
      setPasswordError('')
    }
  }, [newPassword, confirmPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await api.resetPassword(token, newPassword)
      setSuccess(true)
      setError('')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4a6c7a] via-[#5a7c8a] to-[#6a8c9a] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-[450px] max-w-full">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold">🔐 Reset Your Password</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <p className="font-semibold mb-2">Password Reset Successful!</p>
                    <p className="text-sm">
                      Your password has been changed. You will be redirected to login shortly.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onSuccess}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition"
              >
                Go to Login Now
              </button>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-4">
                Please enter your new password. Make sure it's at least 8 characters long.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  placeholder="••••••••"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] ${
                    passwordError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                {passwordError && (
                  <p className="text-xs text-red-600 mt-1">
                    {passwordError}
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded text-sm text-yellow-800">
                <p className="font-semibold mb-1">⚠️ Security Notice:</p>
                <p>After resetting your password, you'll need to log in again on all your devices.</p>
              </div>

              <button
                type="submit"
                disabled={loading || !!passwordError}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

