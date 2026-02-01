import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../utils/api'
import { encryptionKeyManager } from '../utils/encryptionKey'
import { TwoFactorSetup } from './TwoFactorSetup'
import { syncManager } from '../utils/syncManager'
import { exportBackup, downloadBackup, validateBackup, importBackup } from '../utils/backup'
import { formatDateWithSettings } from '../utils/dateFormat'
import { ReferralCouponsPanel } from './ReferralCouponsPanel'
import { TokenManagement } from './TokenManagement'
import { AIConfigPanel } from './AIConfigPanel'

interface ProfileMenuProps {
  onClose: () => void
  showDecryptionWarning?: boolean
}

export function ProfileMenu({ onClose, showDecryptionWarning }: ProfileMenuProps) {
  const { user, logout, decryptionFailure, onDecryptionFailureHandled } = useAuth()
  const [customEncryptionKey, setCustomEncryptionKey] = useState('')
  const [confirmCustomKey, setConfirmCustomKey] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [encryptionMessage, setEncryptionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [show2FASetup, setShow2FASetup] = useState(false)
  const [usingCustomKey, setUsingCustomKey] = useState(encryptionKeyManager.isUsingCustomKey())
  const [username, setUsername] = useState(user?.username || '')
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture_url || '')
  const [displayProfileMessage, setDisplayProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [useUpload, setUseUpload] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [pendingBackupData, setPendingBackupData] = useState<any>(null)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showReferralCoupons, setShowReferralCoupons] = useState(false)
  const [showTokenManagement, setShowTokenManagement] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [icalEnabled, setIcalEnabled] = useState(false)
  const [icalUrl, setIcalUrl] = useState<string | null>(null)
  const [icalLoading, setIcalLoading] = useState(false)
  const customKeyInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Auto-open Advanced section if decryption failure
  useEffect(() => {
    if ((showDecryptionWarning || decryptionFailure.hasFailure) && !showAdvanced) {
      setShowAdvanced(true)
      // Focus on custom key input after a short delay
      setTimeout(() => {
        customKeyInputRef.current?.focus()
      }, 300)
    }
  }, [showDecryptionWarning, decryptionFailure.hasFailure, showAdvanced])

  // Update username and profile picture when user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username || '')
      setProfilePicture(user.profile_picture_url || '')
    }
  }, [user])

  // PWA Install prompt handling
  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if app was just installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])


  const handleUpdateProfile = async () => {
    setProfileMessage(null)

    // Validate current password
    if (!currentPassword) {
      setProfileMessage({ type: 'error', text: 'Current password is required' })
      return
    }

    // Check if anything to update
    if (!newEmail && !newPassword) {
      setProfileMessage({ type: 'error', text: 'Please provide new email or new password' })
      return
    }

    // Validate new password if provided
    if (newPassword) {
      if (newPassword.length < 8) {
        setProfileMessage({ type: 'error', text: 'New password must be at least 8 characters' })
        return
      }
      if (newPassword !== confirmPassword) {
        setProfileMessage({ type: 'error', text: 'Passwords do not match' })
        return
      }
    }

    try {
      await api.updateProfile(currentPassword, newEmail || undefined, newPassword || undefined)
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' })
      
      // Clear form
      setCurrentPassword('')
      setNewEmail('')
      setNewPassword('')
      setConfirmPassword('')

      // If password was changed, user will need to log in again
      if (newPassword) {
        setTimeout(() => {
          alert('Password changed successfully! Please log in again.')
          window.location.reload()
        }, 1500)
      }
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setDisplayProfileMessage({ type: 'error', text: 'Only JPEG, PNG, and WebP images are allowed' })
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setDisplayProfileMessage({ type: 'error', text: 'Image must be smaller than 2MB' })
      return
    }

    setSelectedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpdateDisplayProfile = async () => {
    setDisplayProfileMessage(null)

    // Validate username if provided
    if (username && username.length > 100) {
      setDisplayProfileMessage({ type: 'error', text: 'Username must be 100 characters or less' })
      return
    }

    try {
      let pictureUrl = profilePicture

      // Handle file upload if in upload mode and file selected
      if (useUpload && selectedFile) {
        setUploading(true)
        try {
          const uploadResult = await api.uploadProfilePicture(selectedFile)
          pictureUrl = uploadResult.url
          setDisplayProfileMessage({ type: 'success', text: 'Image uploaded successfully!' })
        } catch (error: any) {
          setDisplayProfileMessage({ type: 'error', text: error.message || 'Upload failed' })
          setUploading(false)
          return
        } finally {
          setUploading(false)
        }
      }

      // Validate profile picture URL if provided and not in upload mode
      if (!useUpload && profilePicture) {
        try {
          new URL(profilePicture)
        } catch {
          setDisplayProfileMessage({ type: 'error', text: 'Profile picture must be a valid URL' })
          return
        }
      }

      // Update profile with username and picture URL
      await api.updateProfileDisplay(
        username || null,
        pictureUrl || null
      )
      setDisplayProfileMessage({ type: 'success', text: 'Profile updated successfully!' })
      
      // Refresh user data to show updated info
      setTimeout(() => window.location.reload(), 1000)
    } catch (error: any) {
      setDisplayProfileMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    }
  }

  const handleSetCustomKey = async () => {
    setEncryptionMessage(null)

    if (!customEncryptionKey || customEncryptionKey.length < 8) {
      setEncryptionMessage({ type: 'error', text: 'Custom key must be at least 8 characters' })
      return
    }

    if (customEncryptionKey !== confirmCustomKey) {
      setEncryptionMessage({ type: 'error', text: 'Keys do not match' })
      return
    }

    try {
      await encryptionKeyManager.setCustomKey(customEncryptionKey)
      setUsingCustomKey(true)
      setEncryptionMessage({ type: 'success', text: '✅ Custom encryption key set successfully! Use the same key on all devices.' })
      setCustomEncryptionKey('')
      setConfirmCustomKey('')
      
      // If decryption failure was active, try to retry sync
      if (decryptionFailure.hasFailure) {
        try {
          await syncManager.retrySync()
          onDecryptionFailureHandled()
          setEncryptionMessage({ type: 'success', text: '✅ Custom encryption key set and sync retried successfully!' })
        } catch (retryError) {
          setEncryptionMessage({ type: 'error', text: 'Custom key set, but sync still failed. Please check the key is correct.' })
        }
      }
    } catch (error: any) {
      setEncryptionMessage({ type: 'error', text: error.message || 'Failed to set custom key' })
    }
  }

  const handleForceOverwrite = async () => {
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete all encrypted data on the server.\n\n' +
      'All your tasks, settings, notebooks, and archived tables stored on the server will be lost.\n\n' +
      'Are you absolutely sure you want to proceed?'
    )
    
    if (!confirmed) {
      return
    }

    try {
      await syncManager.forceOverwrite()
      onDecryptionFailureHandled()
      setEncryptionMessage({ type: 'success', text: '⚠️ Server data has been overwritten with local data.' })
    } catch (error: any) {
      setEncryptionMessage({ type: 'error', text: error.message || 'Failed to force overwrite' })
    }
  }

  const handleBackup = () => {
    try {
      const backupJson = exportBackup()
      const backup = JSON.parse(backupJson)
      
      if (backup._warnings && backup._warnings.length > 0) {
        const proceed = window.confirm(
          `⚠️ WARNING: Your backup has data integrity issues:\n\n` +
          backup._warnings.join('\n') +
          `\n\nThis backup may not contain all your data (e.g., custom task groups). ` +
          `You may want to fix your data before creating a backup.\n\n` +
          `Do you still want to download this backup?`
        )
        if (!proceed) return
      }
      
      downloadBackup(backupJson)
      setBackupMessage({ type: 'success', text: '✅ Backup downloaded successfully!' })
      setTimeout(() => setBackupMessage(null), 3000)
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Failed to create backup' })
      setTimeout(() => setBackupMessage(null), 5000)
    }
  }

  const handleRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('📁 File selected for restore:', file.name, file.size, 'bytes')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string
        console.log('📄 File read, length:', jsonString.length)
        const validation = validateBackup(jsonString)
        
        console.log('✅ Backup validation result:', validation.valid, validation.error)
        
        if (!validation.valid) {
          console.error('❌ Backup validation failed:', validation.error)
          setBackupMessage({ type: 'error', text: validation.error || 'Invalid backup file' })
          setTimeout(() => setBackupMessage(null), 5000)
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          return
        }

        console.log('✅ Backup validated, showing confirmation dialog')
        // Store validated backup data and show confirmation
        setPendingBackupData(validation.data)
        setShowRestoreConfirm(true)
        console.log('✅ Dialog state set to true, pendingBackupData:', validation.data?.tables?.length || 0, 'tables')
      } catch (error: any) {
        console.error('❌ Error reading backup file:', error)
        setBackupMessage({ type: 'error', text: `Failed to read backup file: ${error.message}` })
        setTimeout(() => setBackupMessage(null), 5000)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    
    reader.onerror = () => {
      console.error('❌ FileReader error')
      setBackupMessage({ type: 'error', text: 'Failed to read backup file' })
      setTimeout(() => setBackupMessage(null), 5000)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    
    reader.readAsText(file)
  }

  const handleRestoreConfirm = async () => {
    if (!pendingBackupData) return

    try {
      await importBackup(pendingBackupData)
      // Set flag in sessionStorage to prevent sync from overwriting the restored backup
      // sessionStorage persists across page reload but clears when tab closes
      sessionStorage.setItem('tigement_skip_initial_sync', 'true')
      // Reload IMMEDIATELY to prevent auto-save from overwriting the restored data
      window.location.reload()
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Failed to restore backup' })
      setTimeout(() => setBackupMessage(null), 5000)
      setShowRestoreConfirm(false)
      setPendingBackupData(null)
    }
  }

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false)
    setPendingBackupData(null)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleInstallApp = async () => {
    if (!installPrompt) return

    // Show the install prompt
    installPrompt.prompt()

    // Wait for user response
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    }

    // Clear the prompt
    setInstallPrompt(null)
  }

  const handleRevertToDefault = async () => {
    if (!confirm('Are you sure you want to revert to default encryption (login password)? This will clear your custom key from this device.')) {
      return
    }

    try {
      encryptionKeyManager.revertToLoginPassword()
      setUsingCustomKey(false)
      setEncryptionMessage({ type: 'success', text: '✅ Reverted to default encryption (login password)' })
    } catch (error: any) {
      setEncryptionMessage({ type: 'error', text: error.message || 'Failed to revert encryption' })
    }
  }

  const handleEnableIcal = async () => {
    // Show warning and get confirmation
    const confirmed = confirm(
      '⚠️ PRIVACY NOTICE:\n\n' +
      'iCal export requires storing your task data UNENCRYPTED on the server so external calendar applications (Google Calendar, Apple Calendar, Outlook, etc.) can access it.\n\n' +
      'While this feature is enabled, your calendar data will NOT be end-to-end encrypted.\n\n' +
      'Only enable this if you need calendar integration and accept this limitation.\n\n' +
      'Continue?'
    )

    if (!confirmed) return

    setIcalLoading(true)
    try {
      const response = await api.generateICalToken()
      setIcalUrl(response.url)
      setIcalEnabled(true)
      alert('✅ iCal export enabled! Copy the subscription URL below to add to your calendar app.')
    } catch (error: any) {
      alert('Failed to enable iCal export: ' + (error.message || 'Unknown error'))
    } finally {
      setIcalLoading(false)
    }
  }

  const handleDisableIcal = async () => {
    const confirmed = confirm(
      '⚠️ This will:\n' +
      '• Delete all your calendar data from the server\n' +
      '• Invalidate your subscription URL\n' +
      '• Stop syncing calendar events\n\n' +
      'Continue?'
    )

    if (!confirmed) return

    setIcalLoading(true)
    try {
      await api.disableICalExport()
      setIcalEnabled(false)
      setIcalUrl(null)
      alert('✅ iCal export disabled and all calendar data deleted from server.')
    } catch (error: any) {
      alert('Failed to disable iCal export: ' + (error.message || 'Unknown error'))
    } finally {
      setIcalLoading(false)
    }
  }

  const handleCopyIcalUrl = () => {
    if (icalUrl) {
      navigator.clipboard.writeText(icalUrl)
      alert('✅ Subscription URL copied to clipboard!')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">👤 Profile</h2>
          <button onClick={onClose} className="text-3xl hover:text-gray-300 leading-none">&times;</button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Decryption Failure Warning Banner */}
            {(showDecryptionWarning || decryptionFailure.hasFailure) && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-2">Cannot Decrypt Your Data</h3>
                    <p className="text-sm text-red-800 mb-3">
                      {decryptionFailure.reason || 'Your encryption key does not match the server data. Please enter your custom encryption key or force overwrite (will lose server data).'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowAdvanced(true)
                          setTimeout(() => customKeyInputRef.current?.focus(), 100)
                        }}
                        className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition text-sm"
                      >
                        Enter Custom Key
                      </button>
                      <button
                        onClick={handleForceOverwrite}
                        className="px-4 py-2 bg-red-800 text-white hover:bg-red-900 rounded transition text-sm"
                      >
                        Force Overwrite (Lose Server Data)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Profile: Display Name & Picture Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🖼️ Display Profile</h3>
              
              <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-4">
                {displayProfileMessage && (
                  <div className={`p-3 rounded mb-3 ${displayProfileMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {displayProfileMessage.text}
                  </div>
                )}

                <p className="text-xs text-gray-600 mb-3">
                  Customize how your name and picture appear in the user menu. These are optional and don't affect your login credentials.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username (optional)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                      placeholder={user?.email || 'Enter username'}
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max 100 characters. Any characters allowed.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Profile Picture (optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setUseUpload(!useUpload)
                          setSelectedFile(null)
                          setPreviewUrl(null)
                          setDisplayProfileMessage(null)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        {useUpload ? 'Use URL instead' : 'Upload image instead'}
                      </button>
                    </div>

                    {useUpload ? (
                      <div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileSelect}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Max 2MB. JPEG, PNG, or WebP only.
                        </p>
                        {(previewUrl || (user?.profile_picture_url && !selectedFile)) && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 mb-1">Preview:</p>
                            <img 
                              src={previewUrl || user?.profile_picture_url || ''} 
                              alt="Profile preview" 
                              className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <input
                          type="url"
                          value={profilePicture}
                          onChange={(e) => setProfilePicture(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                          placeholder="https://example.com/avatar.jpg"
                        />
                        {profilePicture && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600 mb-1">Preview:</p>
                            <img 
                              src={profilePicture} 
                              alt="Profile preview" 
                              className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleUpdateDisplayProfile}
                    disabled={uploading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Save Display Profile'}
                  </button>
                </div>
              </div>
            </div>

            {/* Profile: Email & Password Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🔒 Account Security</h3>
              
              <div className="bg-gray-50 p-4 rounded border border-gray-200 mb-4">
                <div className="mb-3 space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong>Email:</strong> {user?.email || 'Not logged in'}
                  </p>
                  {user && (
                    <>
                      <p className="text-sm text-gray-700">
                        <strong>Plan:</strong> {user.plan === 'premium' ? '✨ Premium' : '🆓 Free'}
                        {user.subscription_status && ` (${user.subscription_status})`}
                      </p>
                      {user.plan === 'premium' && user.expires_at && (
                        <>
                          <p className="text-sm text-gray-700">
                            <strong>Started:</strong> {formatDateWithSettings(user.started_at || user.created_at)}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Expires:</strong> {formatDateWithSettings(user.expires_at)}
                            {new Date(user.expires_at) < new Date() && (
                              <span className="ml-2 text-red-600 font-semibold">⚠️ Expired</span>
                            )}
                            {new Date(user.expires_at) > new Date() && new Date(user.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && (
                              <span className="ml-2 text-orange-600 font-semibold">⚠️ Expiring Soon</span>
                            )}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>

                {profileMessage && (
                  <div className={`p-3 rounded mb-3 ${profileMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {profileMessage.text}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password *
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Email (optional)
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                      placeholder="Leave blank to keep current"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password (optional)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                      placeholder="Leave blank to keep current (min 8 chars)"
                    />
                  </div>

                  {newPassword && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                        placeholder="Re-enter new password"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleUpdateProfile}
                    className="w-full px-4 py-2 bg-[#4fc3f7] text-white hover:bg-[#3fa9d1] rounded transition font-medium"
                  >
                    Update Profile
                  </button>

                  <p className="text-xs text-gray-500">
                    ⚠️ If you change your password, you'll be logged out and need to log in again.
                  </p>
                </div>
              </div>
            </div>

            {/* Security: Two-Factor Authentication Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🔐 Security</h3>
              
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Add an extra layer of security by requiring a code from your phone when logging in.
                    </p>
                  </div>
                  <div className="text-3xl">🔐</div>
                </div>
                <button
                  onClick={() => setShow2FASetup(true)}
                  className="w-full px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded transition"
                >
                  Manage 2FA Settings
                </button>
              </div>
            </div>

            {/* Data Backup Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">💾 Data Backup</h3>
              
              <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Download Backup</h4>
                    <p className="text-sm text-blue-800">
                      Export all your data (tables, settings, task groups, notebooks, archived tables) as a JSON file for backup.
                    </p>
                  </div>
                  <div className="text-3xl">💾</div>
                </div>

                {backupMessage && (
                  <div className={`p-3 rounded mb-3 ${backupMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {backupMessage.text}
                  </div>
                )}

                <button
                  onClick={handleBackup}
                  className="w-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition"
                >
                  📥 Download Backup
                </button>
                <p className="text-xs text-blue-700 mt-2">
                  ℹ️ Backup includes all your workspace data in readable JSON format
                </p>
              </div>

              <div className="bg-orange-50 p-4 rounded border border-orange-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-orange-900 mb-1">Restore Backup</h4>
                    <p className="text-sm text-orange-800">
                      Import a previously exported backup file. This will replace all your current data.
                    </p>
                  </div>
                  <div className="text-3xl">📤</div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreFileSelect}
                  className="hidden"
                  id="restore-file-input"
                />
                <label
                  htmlFor="restore-file-input"
                  className="w-full px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded transition cursor-pointer inline-block text-center"
                >
                  📤 Choose Backup File
                </label>
                <p className="text-xs text-orange-700 mt-2">
                  ⚠️ Warning: Restoring will replace all your current data
                </p>
              </div>
            </div>

            {/* PWA Install Section */}
            {!isInstalled && installPrompt && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📱 Install App</h3>
                
                <div className="bg-green-50 p-4 rounded border border-green-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-green-900 mb-1">Create Shortcut</h4>
                      <p className="text-sm text-green-800">
                        Install Tigement as an app on your device for quick access.
                      </p>
                    </div>
                    <div className="text-3xl">📱</div>
                  </div>

                  <button
                    onClick={handleInstallApp}
                    className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded transition"
                  >
                    📲 Install App
                  </button>
                  <p className="text-xs text-green-700 mt-2">
                    ℹ️ Creates a desktop shortcut (PC) or home screen icon (mobile)
                  </p>
                </div>
              </div>
            )}

            {/* iCal Export (Premium Only) */}
            {user?.plan === 'premium' && user?.subscription_status === 'active' && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📅 iCal Calendar Export</h3>
                
                <div className="bg-yellow-50 p-4 rounded border border-yellow-300">
                  {/* Warning Banner */}
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-4">
                    <p className="text-sm font-semibold text-yellow-900 mb-1">⚠️ Privacy Notice</p>
                    <p className="text-xs text-yellow-800">
                      iCal export stores your task data <strong>unencrypted</strong> on the server for external calendar apps to access. 
                      Your data will <strong>NOT be end-to-end encrypted</strong> while this feature is enabled.
                    </p>
                  </div>

                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-yellow-900 mb-1">Calendar Subscription</h4>
                      <p className="text-sm text-yellow-800">
                        Subscribe to your tasks in Google Calendar, Apple Calendar, Outlook, and other calendar apps.
                      </p>
                    </div>
                    <div className="text-3xl">📅</div>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-yellow-900">
                      {icalEnabled ? '✅ Enabled' : '⭕ Disabled'}
                    </span>
                    <button
                      onClick={icalEnabled ? handleDisableIcal : handleEnableIcal}
                      disabled={icalLoading}
                      className={`px-4 py-2 rounded transition ${
                        icalEnabled 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      } ${icalLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {icalLoading ? '⏳ Processing...' : (icalEnabled ? '🚫 Disable & Delete Data' : '✅ Enable iCal Export')}
                    </button>
                  </div>

                  {/* Subscription URL */}
                  {icalEnabled && icalUrl && (
                    <div className="mt-4 p-3 bg-white rounded border border-yellow-300">
                      <p className="text-xs font-semibold text-yellow-900 mb-2">📋 Subscription URL:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={icalUrl}
                          readOnly
                          className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded bg-gray-50 font-mono"
                        />
                        <button
                          onClick={handleCopyIcalUrl}
                          className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition whitespace-nowrap"
                        >
                          📋 Copy
                        </button>
                      </div>
                      <p className="text-xs text-yellow-700 mt-2">
                        ℹ️ Add this URL to your calendar app as a "subscription" or "webcal" feed. It will update automatically.
                      </p>
                    </div>
                  )}

                  {!icalEnabled && (
                    <p className="text-xs text-yellow-700 mt-2">
                      ℹ️ Alternative: Use <strong>Data menu → Export Calendar (.ics)</strong> for a privacy-friendly one-time export.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* API Tokens Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🔑 API Tokens</h3>
              
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Programmatic Access</h4>
                    <p className="text-sm text-blue-800">
                      Generate API tokens for CLI tools, scripts, and third-party integrations.
                    </p>
                  </div>
                  <div className="text-3xl">🔑</div>
                </div>

                <button
                  onClick={() => setShowTokenManagement(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition"
                >
                  🎫 Manage API Tokens
                </button>
                <p className="text-xs text-blue-700 mt-2">
                  ℹ️ Tokens enable decryption and maintain end-to-end encryption
                </p>
              </div>
            </div>

            {/* AI Assistant Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">🤖 AI Assistant</h3>
              
              <div className="bg-purple-50 p-4 rounded border border-purple-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-purple-900 mb-1">Bring Your Own AI</h4>
                    <p className="text-sm text-purple-800">
                      Connect OpenAI, Anthropic, or your own AI model to help manage tasks.
                    </p>
                  </div>
                  <div className="text-3xl">🤖</div>
                </div>

                <button
                  onClick={() => setShowAIConfig(true)}
                  className="w-full px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded transition"
                >
                  ⚙️ Configure AI Assistant
                </button>
                <p className="text-xs text-purple-700 mt-2">
                  ℹ️ Processing happens in your browser. API keys stored encrypted locally.
                </p>
              </div>
            </div>

            {/* Referral Coupons (Premium Only) */}
            {user?.plan === 'premium' && user?.subscription_status === 'active' && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🎁 Referral Coupons</h3>
                
                <div className="bg-purple-50 p-4 rounded border border-purple-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-purple-900 mb-1">Share & Earn</h4>
                      <p className="text-sm text-purple-800">
                        Get referral coupons to share with friends or sell. Each coupon grants free Premium!
                      </p>
                    </div>
                    <div className="text-3xl">✨</div>
                  </div>

                  <button
                    onClick={() => setShowReferralCoupons(true)}
                    className="w-full px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded transition"
                  >
                    🎟️ Manage Referral Coupons
                  </button>
                  <p className="text-xs text-purple-700 mt-2">
                    ℹ️ Share your coupons on social media, give them to friends, or sell them!
                  </p>
                </div>
              </div>
            )}

            {/* Advanced: Custom E2E Encryption Section */}
            <div className="border-t pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Advanced: Custom Encryption</h3>
                  <p className="text-xs text-gray-500">For power users who want separate encryption key from login password</p>
                </div>
                <span className="text-2xl text-gray-400">{showAdvanced ? '▼' : '▶'}</span>
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-4 bg-yellow-50 p-4 rounded border border-yellow-200">
                  <div className="text-sm text-yellow-800 bg-yellow-100 p-3 rounded">
                    ⚠️ <strong>Warning:</strong> By default, your data is encrypted with your login password. 
                    Only set a custom key if you want a different encryption password. 
                    You must use the <strong>SAME custom key on ALL devices</strong> or sync will fail!
                  </div>

                  {/* Current Status */}
                  <div className={`p-3 rounded border ${
                    usingCustomKey 
                      ? 'bg-purple-100 border-purple-300 text-purple-800' 
                      : 'bg-green-100 border-green-300 text-green-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>Current Mode:</strong> {usingCustomKey ? 'Custom Encryption Key' : 'Login Password (Default)'}
                      </div>
                      {usingCustomKey && (
                        <button
                          onClick={handleRevertToDefault}
                          className="px-3 py-1 bg-purple-500 text-white hover:bg-purple-600 rounded text-sm transition"
                        >
                          Revert to Default
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Encryption Key
                    </label>
                    <input
                      ref={customKeyInputRef}
                      type="password"
                      value={customEncryptionKey}
                      onChange={(e) => setCustomEncryptionKey(e.target.value)}
                      placeholder="Enter custom encryption key (min 8 chars)"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Custom Key
                    </label>
                    <input
                      type="password"
                      value={confirmCustomKey}
                      onChange={(e) => setConfirmCustomKey(e.target.value)}
                      placeholder="Re-enter custom encryption key"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                    />
                  </div>

                  <button
                    onClick={handleSetCustomKey}
                    className="w-full px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded transition"
                  >
                    Set Custom Encryption Key
                  </button>

                  {encryptionMessage && (
                    <div className={`p-3 rounded text-sm ${
                      encryptionMessage.type === 'success' 
                        ? 'bg-green-100 text-green-800 border border-green-300' 
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}>
                      {encryptionMessage.text}
                    </div>
                  )}

                  <div className="text-xs text-gray-600 bg-gray-100 p-3 rounded">
                    <strong>How it works:</strong><br/>
                    1. Set the same custom key on Device A<br/>
                    2. Set the same custom key on Device B<br/>
                    3. Data encrypted with custom key will sync between devices<br/>
                    4. Key is stored in browser memory (sessionStorage), never sent to server
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="border-t pt-4">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to log out?')) {
                    logout()
                    onClose()
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* 2FA Setup Modal */}
        {show2FASetup && (
          <TwoFactorSetup onClose={() => setShow2FASetup(false)} />
        )}

        {/* Restore Confirmation Dialog */}
        {showRestoreConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-red-900 mb-4">⚠️ Confirm Restore</h3>
              <div className="mb-4">
                <p className="text-gray-800 mb-2">
                  <strong>Warning:</strong> This will permanently replace all your current data with the backup data.
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  All existing tables, settings, task groups, notebooks, and archived tables will be lost and replaced.
                </p>
                {pendingBackupData && (
                  <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
                    <p><strong>Backup Info:</strong></p>
                    <p>Version: {pendingBackupData.version}</p>
                    <p>Exported: {new Date(pendingBackupData.exportedAt).toLocaleString()}</p>
                    <p>Tables: {pendingBackupData.tables?.length || 0}</p>
                    <p>Archived Tables: {pendingBackupData.archivedTables?.length || 0}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRestoreConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition font-medium"
                >
                  Yes, Restore
                </button>
                <button
                  onClick={handleRestoreCancel}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 hover:bg-gray-400 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Referral Coupons Panel */}
        {showReferralCoupons && (
          <ReferralCouponsPanel onClose={() => setShowReferralCoupons(false)} />
        )}

        {/* Token Management Panel */}
        {showTokenManagement && (
          <TokenManagement onClose={() => setShowTokenManagement(false)} />
        )}

        {/* AI Config Panel */}
        {showAIConfig && (
          <AIConfigPanel onClose={() => setShowAIConfig(false)} />
        )}
      </div>
    </div>
  )
}

