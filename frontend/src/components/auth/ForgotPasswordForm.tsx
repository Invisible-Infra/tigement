import { useState } from 'react'
import { api } from '../../utils/api'

interface ForgotPasswordFormProps {
  onClose: () => void
  onBackToLogin: () => void
}

export function ForgotPasswordForm({ onClose, onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.requestPasswordReset(email)
      setSuccess(true)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[400px] max-h-[80vh] overflow-y-auto">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Reset Password</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
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
                    <p className="font-semibold mb-2">Check your email!</p>
                    <p className="text-sm">
                      If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
                    </p>
                    <p className="text-sm mt-2">
                      The link will expire in 1 hour for security reasons.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 px-4 py-3 rounded">
                <p className="font-semibold mb-1">Didn't receive the email?</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Check your spam/junk folder</li>
                  <li>Wait a few minutes for delivery</li>
                  <li>Try requesting a new reset link</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  placeholder="your@email.com"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

