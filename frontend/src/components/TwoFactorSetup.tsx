import { useState, useEffect } from 'react'
import { api } from '../utils/api'

interface TwoFactorSetupProps {
  onClose: () => void
}

export function TwoFactorSetup({ onClose }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'check' | 'setup' | 'verify' | 'backup'>('check')
  const [qrCode, setQrCode] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [verifyToken, setVerifyToken] = useState<string>('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const status = await api.get2FAStatus()
      setIsEnabled(status.enabled)
      setStep(status.enabled ? 'check' : 'setup')
    } catch (err) {
      console.error('Failed to check 2FA status:', err)
    }
  }

  const handleSetup = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.setup2FA()
      setQrCode(response.qrCode)
      setSecret(response.secret)
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (!verifyToken || verifyToken.length !== 6) {
        setError('Please enter a 6-digit code')
        return
      }

      const response = await api.verify2FA(verifyToken)
      setBackupCodes(response.backupCodes)
      setStep('backup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (!disablePassword) {
        setError('Password is required')
        return
      }

      await api.disable2FA(disablePassword)
      alert('2FA has been disabled')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    alert('Backup codes copied to clipboard!')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-y-auto">
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">Two-Factor Authentication (2FA)</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        <div className="p-6">
          {/* Check Status / Already Enabled */}
          {step === 'check' && isEnabled && (
            <div className="space-y-4">
              <div className="bg-green-100 text-green-800 p-4 rounded border border-green-300">
                ✅ Two-factor authentication is currently <strong>enabled</strong> for your account.
              </div>

              <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                <p className="text-sm text-gray-700 mb-3">
                  To disable 2FA, enter your password:
                </p>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-3 py-2 border border-gray-300 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                />
                <button
                  onClick={handleDisable}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded transition disabled:opacity-50"
                >
                  {loading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>

              {error && (
                <div className="bg-red-100 text-red-800 p-3 rounded border border-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Setup Step */}
          {step === 'setup' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Why enable 2FA?</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Adds an extra layer of security to your account</li>
                  <li>Protects against password theft</li>
                  <li>Industry best practice for sensitive data</li>
                </ul>
              </div>

              <div className="text-sm text-gray-700">
                <p className="mb-2">To enable 2FA, you'll need:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
                  <li>Your phone or tablet</li>
                  <li>About 2 minutes of your time</li>
                </ol>
              </div>

              <button
                onClick={handleSetup}
                disabled={loading}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Start Setup'}
              </button>
            </div>
          )}

          {/* Verify Step */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-3">Scan QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code with your authenticator app:
                </p>
                {qrCode && (
                  <img
                    src={qrCode}
                    alt="2FA QR Code"
                    className="mx-auto border-4 border-gray-200 rounded"
                  />
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-600 mb-1">Manual entry code:</p>
                <code className="text-sm font-mono bg-white px-2 py-1 rounded border border-gray-300 break-all">
                  {secret}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter the 6-digit code from your app:
                </label>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  maxLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-100 text-red-800 p-3 rounded border border-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || verifyToken.length !== 6}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>
            </div>
          )}

          {/* Backup Codes Step */}
          {step === 'backup' && (
            <div className="space-y-4">
              <div className="bg-green-100 text-green-800 p-4 rounded border border-green-300">
                ✅ <strong>2FA Enabled Successfully!</strong>
              </div>

              <div className="bg-yellow-50 p-4 rounded border border-yellow-300">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Save Your Backup Codes</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  These codes can be used to access your account if you lose your authenticator device. 
                  Each code works only once. Store them in a safe place!
                </p>

                <div className="bg-white p-4 rounded border border-yellow-400 mb-3">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, i) => (
                      <div key={i} className="bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={copyBackupCodes}
                  className="w-full px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded transition mb-2"
                >
                  📋 Copy All Codes to Clipboard
                </button>

                <p className="text-xs text-yellow-700">
                  💡 Tip: Print these codes and store them in a secure location (e.g., a safe or password manager).
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3ba3d7] rounded transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

