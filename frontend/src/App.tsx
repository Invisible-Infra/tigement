import { useState, useEffect, useRef } from 'react'
import { Workspace } from './components/Workspace'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { loadTables, loadNotebooks, saveTables, saveNotebooks, hasShownAnonMergePrompt, setShownAnonMergePrompt, stashAnonDataSnapshot, loadStashedAnonData, clearStashedAnonData } from './utils/storage'
import { detectNonEmptyLocalData, planMerge, applyMerge, type MergeWorkspace } from './utils/mergeLocalData'
import { syncManager } from './utils/syncManager'
import { MergeLocalDataDialog } from './components/MergeLocalDataDialog'
import { api } from './utils/api'
import { decryptWorkspace } from './utils/encryption'
import { encryptionKeyManager } from './utils/encryptionKey'
import { LoginForm } from './components/auth/LoginForm'
import { RegisterForm } from './components/auth/RegisterForm'
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm'
import { ResetPasswordForm } from './components/auth/ResetPasswordForm'
import { EncryptionPassphraseDialog } from './components/auth/EncryptionPassphraseDialog'
import { AdminPanel } from './components/admin/AdminPanel'
import { PremiumPage } from './components/premium/PremiumPage'
import { ProfileMenu } from './components/ProfileMenu'
import { AdminAnnouncement } from './components/AdminAnnouncement'

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { isAuthenticated, user, logout, decryptionFailure, onDecryptionFailureHandled } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [showPremium, setShowPremium] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [detectedLocal, setDetectedLocal] = useState<any>(null)
  const [serverSnapshot, setServerSnapshot] = useState<MergeWorkspace | null>(null)
  const mergeDialogShownRef = useRef(false)
  const [version, setVersion] = useState<string>('alpha')
  const [oauthPassphraseDialog, setOauthPassphraseDialog] = useState<{ token: string; isNew: boolean } | null>(null)

  // Calculate days until premium expires
  const getDaysUntilExpiry = (expiresAt?: string): number | null => {
    if (!expiresAt) return null
    const expiryDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expiryDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  // Auto-open ProfileMenu when decryption failure is detected
  useEffect(() => {
    if (decryptionFailure.hasFailure && isAuthenticated && !showProfile) {
      setShowProfile(true)
    }
  }, [decryptionFailure.hasFailure, isAuthenticated, showProfile])

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token && window.location.pathname === '/reset-password') {
      setResetToken(token)
    }
  }, [])

  // If we have a reset token, show the reset password form
  if (resetToken) {
    return (
      <ResetPasswordForm
        token={resetToken}
        onSuccess={() => {
          setResetToken(null)
          // Clear URL parameters and navigate to home
          window.history.pushState({}, '', '/')
          setShowLogin(true)
        }}
      />
    )
  }

  // Fetch version on mount
  useEffect(() => {
    api.getVersion()
      .then((data) => setVersion(data.version))
      .catch(() => setVersion('alpha')) // Fallback to 'alpha' if fetch fails
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthToken = params.get('oauth_token')
    const oauthError = params.get('oauth_error')

    if (oauthError) {
      alert(`OAuth authentication failed: ${oauthError}`)
      window.history.replaceState({}, '', '/')
      return
    }

    if (oauthToken) {
      // Decode JWT token to check if passphrase is needed
      try {
        const payload = JSON.parse(atob(oauthToken.split('.')[1]))
        setOauthPassphraseDialog({
          token: oauthToken,
          isNew: !payload.has_passphrase
        })
      } catch (error) {
        console.error('Failed to decode OAuth token:', error)
        alert('Invalid OAuth token')
      }
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Reset merge dialog ref when logging out
  useEffect(() => {
    if (!isAuthenticated) {
      mergeDialogShownRef.current = false
    }
  }, [isAuthenticated])

  // After login, detect anonymous local data and offer to merge
  useEffect(() => {
    if (!isAuthenticated) return
    // Only show once per login session
    if (mergeDialogShownRef.current) return
    
    const loadServerDataAndShowMerge = async () => {
      // Prefer pre-login stashed snapshot if present (guarantees we didn't miss anon data)
      const stashed = loadStashedAnonData('pre_login')
      // Only prompt automatically when a pre-login stash exists
      if (!stashed) return
      
      const anonTables = stashed?.tables ?? loadTables()
      const anonNotebooks = stashed?.notebooks ?? loadNotebooks()
      const detected = detectNonEmptyLocalData(anonTables, anonNotebooks)
      const hasItems =
        detected.nonEmptyTables.length > 0 ||
        !!detected.nonEmptyNotebooks.workspace ||
        Object.keys(detected.nonEmptyNotebooks.tasks || {}).length > 0
      if (!hasItems) {
        // Clear stash if no items to merge
        try { clearStashedAnonData('pre_login') } catch {}
        return
      }
      
      // Fetch ACTUAL server workspace data to preserve user's existing tables
      let serverData: MergeWorkspace = {
        tables: [],
        notebooks: { workspace: '', tasks: {} }
      }
      
      try {
        const remoteWorkspace = await api.getWorkspace()
        if (remoteWorkspace && remoteWorkspace.data) {
          const encryptionKey = encryptionKeyManager.getKey()
          if (encryptionKey) {
            const decryptedData = await decryptWorkspace(remoteWorkspace.data, encryptionKey)
            serverData = {
              tables: decryptedData.tables || [],
              notebooks: {
                workspace: decryptedData.workspace_notebook || '',
                tasks: decryptedData.task_notebooks || {}
              }
            }
            console.log('📦 Loaded server data for merge:', {
              serverTables: serverData.tables.length,
              localTables: detected.nonEmptyTables.length
            })
          }
        }
      } catch (error) {
        console.error('❌ Failed to load server workspace for merge:', error)
        // Continue with empty serverData if fetch fails
      }
      
      // Keep snapshots for merge action
      setServerSnapshot(serverData)
      setDetectedLocal(detected)
      setShowMergeDialog(true)
      mergeDialogShownRef.current = true
      // Don't clear stash here - wait until user interacts
    }
    
    loadServerDataAndShowMerge()
  }, [isAuthenticated])

  const handleMergeConfirm = () => {
    if (!serverSnapshot || !detectedLocal) {
      setShowMergeDialog(false)
      setShownAnonMergePrompt()
      return
    }
    // Stash anon snapshot for troubleshooting
    try {
      stashAnonDataSnapshot('pre_merge', loadTables(), loadNotebooks())
    } catch {}
    const plan = planMerge(detectedLocal, serverSnapshot)
    const { merged } = applyMerge(serverSnapshot, plan)
    saveTables(merged.tables)
    saveNotebooks({ workspace: merged.notebooks?.workspace || '', tasks: merged.notebooks?.tasks || {} })
    setShowMergeDialog(false)
    setShownAnonMergePrompt()
    // Clear stash after merge
    try { clearStashedAnonData('pre_login') } catch {}
    // Reload page to show merged data in UI
    window.location.reload()
  }

  const handleMergeSkip = () => {
    setShowMergeDialog(false)
    setShownAnonMergePrompt()
    // Clear stash after user interaction
    try { clearStashedAnonData('pre_login') } catch {}
  }

  // Allow triggering merge prompt later from Workspace menu
  useEffect(() => {
    const handler = () => {
      // reset flag and re-run detection
      try { localStorage.removeItem('tigement_anon_merge_prompt_shown') } catch {}
      const anonTables = loadTables()
      const anonNotebooks = loadNotebooks()
      const detected = detectNonEmptyLocalData(anonTables, anonNotebooks)
      const hasItems =
        detected.nonEmptyTables.length > 0 ||
        !!detected.nonEmptyNotebooks.workspace ||
        Object.keys(detected.nonEmptyNotebooks.tasks || {}).length > 0
      if (!hasItems) return
      const current: MergeWorkspace = {
        tables: loadTables() || [],
        notebooks: loadNotebooks() || { workspace: '', tasks: {} }
      }
      setServerSnapshot(current)
      setDetectedLocal(detected)
      setShowMergeDialog(true)
    }
    window.addEventListener('tigement:request-merge' as any, handler as any)
    return () => window.removeEventListener('tigement:request-merge' as any, handler as any)
  }, [])
  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <nav className="flex-shrink-0 bg-[#4a6c7a] text-white p-4 md:pr-4 pr-16">
        <div className="flex items-center justify-between max-w-full">
          <div className="logo relative inline-block flex-shrink-0">
            <div className="relative inline-block bg-[#2d4a56] px-3 py-1" style={{ transform: 'skewX(-12deg)' }}>
              <span className="text-2xl font-bold italic inline-block text-white">
                Tig<span className="text-[#4fc3f7] inline-block" style={{ verticalAlign: '-0.1em' }}>≡</span>ment
              </span>
              <span className="text-[10px] absolute -bottom-2 right-3 !bg-white text-[#2d4a56] px-1.5 py-0.6 font-medium">{version}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-1 justify-end ml-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setShowProfile(true)}
                  className="px-4 py-2 bg-[#4a6c7a] hover:bg-[#3a5c6a] rounded text-sm transition border border-white/20 flex items-center gap-2"
                >
                  {user?.profile_picture_url ? (
                    <img 
                      src={user.profile_picture_url} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span>👤</span>
                  )}
                  <span>{user?.username || user?.email}</span>
                </button>
                {user?.plan === 'premium' && user?.subscription_status === 'expired' ? (
                  <button
                    onClick={() => setShowPremium(true)}
                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded hidden md:inline-block transition font-medium"
                    title="Click to renew your premium subscription"
                  >
                    Premium (Expired) - Click to Renew
                  </button>
                ) : user?.plan === 'premium' && user?.expires_at ? (() => {
                  const daysLeft = getDaysUntilExpiry(user.expires_at)
                  if (daysLeft !== null && daysLeft <= 7 && daysLeft > 0) {
                    return (
                      <button
                        onClick={() => setShowPremium(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-xs px-2 py-1 rounded hidden md:inline-block cursor-pointer transition"
                        title="Click to extend subscription"
                      >
                        Premium ({daysLeft} {daysLeft === 1 ? 'day' : 'days'})
                      </button>
                    )
                  } else if (user?.in_grace_period) {
                    return (
                      <button
                        onClick={() => setShowPremium(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-xs px-2 py-1 rounded hidden md:inline-block cursor-pointer transition"
                        title="Click to extend subscription"
                      >
                        Premium (Expires Soon)
                      </button>
                    )
                  } else if (user?.subscription_status === 'active') {
                    return (
                      <button
                        onClick={() => setShowPremium(true)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-xs px-2 py-1 rounded hidden md:inline-block cursor-pointer transition"
                        title="Click to extend subscription"
                      >
                        Premium
                      </button>
                    )
                  }
                  return null
                })() : user?.plan === 'premium' && user?.subscription_status === 'active' ? (
                  <button
                    onClick={() => setShowPremium(true)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-xs px-2 py-1 rounded hidden md:inline-block cursor-pointer transition"
                    title="Click to extend subscription"
                  >
                    Premium
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPremium(true)}
                    className="hidden md:block px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-sm transition font-medium"
                  >
                    ✨ Upgrade
                  </button>
                )}
                {user?.is_admin && (
                  <button
                    onClick={() => setShowAdmin(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm transition"
                  >
                    Admin
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-[#4fc3f7] hover:bg-[#3ba3d7] rounded text-sm transition"
                >
                  Login
                </button>
                <button
                  onClick={() => setShowRegister(true)}
                  className="px-4 py-2 bg-white text-[#4a6c7a] hover:bg-gray-100 rounded text-sm transition"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <AdminAnnouncement />

      <div className="flex-1 overflow-hidden">
        <Workspace onShowPremium={() => setShowPremium(true)} />
      </div>

      {showLogin && (
        <LoginForm
          onClose={() => setShowLogin(false)}
          onSwitchToRegister={() => {
            setShowLogin(false)
            setShowRegister(true)
          }}
          onSwitchToForgotPassword={() => {
            setShowLogin(false)
            setShowForgotPassword(true)
          }}
        />
      )}

      {showRegister && (
        <RegisterForm
          onClose={() => setShowRegister(false)}
          onSwitchToLogin={() => {
            setShowRegister(false)
            setShowLogin(true)
          }}
        />
      )}

      {showForgotPassword && (
        <ForgotPasswordForm
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={() => {
            setShowForgotPassword(false)
            setShowLogin(true)
          }}
        />
      )}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {showPremium && <PremiumPage onClose={() => setShowPremium(false)} />}

      {showProfile && (
        <ProfileMenu 
          onClose={() => {
            setShowProfile(false)
            // Don't clear decryption failure if it's still active
            if (!decryptionFailure.hasFailure) {
              onDecryptionFailureHandled()
            }
          }}
          showDecryptionWarning={decryptionFailure.hasFailure}
        />
      )}

      <MergeLocalDataDialog
        open={showMergeDialog}
        local={detectedLocal}
        onMerge={handleMergeConfirm}
        onSkip={handleMergeSkip}
      />

      {/* OAuth Encryption Passphrase Dialog */}
      {oauthPassphraseDialog && (
        <EncryptionPassphraseDialog
          oauthToken={oauthPassphraseDialog.token}
          isNewUser={oauthPassphraseDialog.isNew}
          onSuccess={async (authResponse, passphrase) => {
            // Handle successful authentication
            api.setTokens(authResponse.accessToken, authResponse.refreshToken)
            // Store encryption key derived from passphrase
            encryptionKeyManager.setKey(passphrase)
            setOauthPassphraseDialog(null)
            // Reload to trigger auth context update
            window.location.reload()
          }}
          onError={(error) => {
            console.error('Passphrase error:', error)
          }}
          onClose={() => {
            setOauthPassphraseDialog(null)
          }}
        />
      )}
    </div>
  )
}

export default App

