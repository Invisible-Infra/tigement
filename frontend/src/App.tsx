import { useState, useEffect, useRef } from 'react'
import { Workspace } from './components/Workspace'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { loadTables, loadNotebooks, saveTables, saveNotebooks, hasShownAnonMergePrompt, setShownAnonMergePrompt, stashAnonDataSnapshot, loadStashedAnonData, clearStashedAnonData } from './utils/storage'
import { detectNonEmptyLocalData, planMerge, applyMerge, type MergeWorkspace } from './utils/mergeLocalData'
import { syncManager } from './utils/syncManager'
import { MergeLocalDataDialog } from './components/MergeLocalDataDialog'
import { MigrationDialog } from './components/MigrationDialog'
import { exportBackup, downloadBackup } from './utils/backup'
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
import { OfflineBanner } from './components/OfflineBanner'

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { isAuthenticated, user, logout, decryptionFailure, onDecryptionFailureHandled, isPremium, syncNow } = useAuth()
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
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<any>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

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

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Reset avatar load state when user changes
  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [user?.profile_picture_url])

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token && window.location.pathname === '/reset-password') {
      setResetToken(token)
    }
  }, [])

  // Check migration status on mount when user is authenticated
  useEffect(() => {
    const checkMigration = async () => {
      console.log('🔍 Migration check: isAuthenticated=', isAuthenticated, 'user=', user)
      if (!isAuthenticated || !user) {
        console.log('⏭️ Skipping migration check - not authenticated')
        return
      }
      
      try {
        console.log('🔍 Checking migration status...')
        const response = await api.getMigrationStatus()
        console.log('📋 Migration status response:', response)
        if (response.needsMigration) {
          console.log('📦 User has plaintext data that needs migration:', response.plaintextCounts)
          setMigrationStatus(response)
          setShowMigrationDialog(true)
        } else {
          console.log('✅ No migration needed - user data is up to date')
        }
      } catch (error) {
        console.error('❌ Failed to check migration status:', error)
      }
    }
    
    checkMigration()
  }, [isAuthenticated, user])

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
      if (!stashed) {
        // Clear the flag if there's no stash
        sessionStorage.removeItem('tigement_has_merge_data')
        return
      }
      
      // ONLY use stashed data, never fall back to current localStorage
      // (current localStorage may have been contaminated by cloud sync)
      const anonTables = stashed.tables
      const anonNotebooks = stashed.notebooks
      
      const detected = detectNonEmptyLocalData(anonTables, anonNotebooks)
      const hasItems =
        detected.nonEmptyTables.length > 0 ||
        !!detected.nonEmptyNotebooks.workspace ||
        Object.keys(detected.nonEmptyNotebooks.tasks || {}).length > 0
      if (!hasItems) {
        // Clear stash and flag if no items to merge
        try { clearStashedAnonData('pre_login') } catch {}
        sessionStorage.removeItem('tigement_has_merge_data')
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

  const handleMergeConfirm = async () => {
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
    
    // Force push merged data to cloud before reloading (don't do smart sync)
    if (isPremium) {
      try {
        console.log('🔄 Force pushing merged data to cloud...')
        await syncManager.forcePush()
        console.log('✅ Merged data pushed to cloud')
      } catch (error) {
        console.error('❌ Failed to push merged data:', error)
      }
    }
    
    // Reload page to show merged data in UI
    window.location.reload()
  }

  const handleMergeSkip = async () => {
    setShowMergeDialog(false)
    setShownAnonMergePrompt()
    // Clear stash after user interaction
    try { clearStashedAnonData('pre_login') } catch {}
    
    // Pull cloud data to replace local data
    if (isPremium) {
      try {
        console.log('🔄 Skipped merge - pulling cloud data instead')
        await syncNow()
        window.location.reload()
      } catch (error) {
        console.error('❌ Failed to pull cloud data after skip:', error)
      }
    }
  }

  const handleDownloadBackup = async () => {
    try {
      // First fetch plaintext data from backend if migration is needed
      if (migrationStatus?.needsMigration) {
        console.log('📥 Fetching plaintext data for backup...')
        const plaintextData = await api.fetchPlaintextData()
        
        // Temporarily save to localStorage so exportBackup() includes it
        if (Object.keys(plaintextData.notebooks).length > 0) {
          const notebooksStructure: { workspace: string; tasks: Record<string, string> } = {
            workspace: '',
            tasks: {}
          }
          for (const [key, content] of Object.entries(plaintextData.notebooks)) {
            if (key === 'workspace') {
              notebooksStructure.workspace = content
            } else if (key.startsWith('task-')) {
              notebooksStructure.tasks[key.replace('task-', '')] = content
            }
          }
          localStorage.setItem('tigement_notebooks', JSON.stringify(notebooksStructure))
        }
        if (Object.keys(plaintextData.diaries).length > 0) {
          localStorage.setItem('tigement_diary_entries', JSON.stringify(plaintextData.diaries))
        }
        if (plaintextData.archives.length > 0) {
          localStorage.setItem('tigement_archived_tables', JSON.stringify(plaintextData.archives))
        }
        console.log('✅ Plaintext data loaded into localStorage for backup')
      }
      
      const backupJson = exportBackup()
      downloadBackup(backupJson)
      console.log('✅ Backup downloaded successfully')
    } catch (error) {
      console.error('Failed to download backup:', error)
      throw error
    }
  }

  const handleMigrationComplete = async () => {
    try {
      console.log('🔄 Starting migration process...')
      console.log('⏰ Migration started at:', new Date().toISOString())
      
      // 1. Fetch plaintext data from backend
      console.log('📥 Step 1/4: Fetching plaintext data from server...')
      const plaintextData = await api.fetchPlaintextData()
      console.log('✅ Step 1 complete - Fetched plaintext data:', {
        notebooks: Object.keys(plaintextData.notebooks).length,
        diaries: Object.keys(plaintextData.diaries).length,
        archives: plaintextData.archives.length
      })
      console.log('📄 Plaintext data details:', plaintextData)

      // 2. Save to localStorage (transform notebooks structure)
      console.log('💾 Step 2/4: Saving to localStorage...')
      if (Object.keys(plaintextData.notebooks).length > 0) {
        // Transform flat structure to nested structure
        const notebooksStructure: { workspace: string; tasks: Record<string, string> } = {
          workspace: '',
          tasks: {}
        }
        
        for (const [key, content] of Object.entries(plaintextData.notebooks)) {
          if (key === 'workspace') {
            notebooksStructure.workspace = content
          } else if (key.startsWith('task-')) {
            const taskId = key.replace('task-', '')
            notebooksStructure.tasks[taskId] = content
          }
        }
        
        localStorage.setItem('tigement_notebooks', JSON.stringify(notebooksStructure))
        console.log('📓 Saved notebooks:', { 
          hasWorkspace: !!notebooksStructure.workspace,
          taskCount: Object.keys(notebooksStructure.tasks).length 
        })
      }
      if (Object.keys(plaintextData.diaries).length > 0) {
        localStorage.setItem('tigement_diary_entries', JSON.stringify(plaintextData.diaries))
        console.log('📔 Saved', Object.keys(plaintextData.diaries).length, 'diary entries')
      }
      if (plaintextData.archives.length > 0) {
        localStorage.setItem('tigement_archived_tables', JSON.stringify(plaintextData.archives))
        console.log('🗄️ Saved', plaintextData.archives.length, 'archived tables')
      }
      console.log('✅ Step 2 complete - Data saved to localStorage')

      // 3. Trigger encrypted sync
      console.log('🔐 Step 3/4: Triggering encrypted workspace sync...')
      syncManager.markLocalModified()
      const pushResult = await syncManager.forcePush()
      console.log('✅ Step 3 complete - Data encrypted and synced to server:', pushResult)

      // 4. Delete plaintext from backend
      console.log('🗑️ Step 4/4: Deleting plaintext data from server...')
      const deleteResult = await api.deletePlaintextData()
      console.log('✅ Step 4 complete - Plaintext data deleted from server:', deleteResult)

      console.log('🎉 Migration complete!')
      console.log('⏰ Migration finished at:', new Date().toISOString())
      setShowMigrationDialog(false)
      
      // Small delay to ensure backend has processed the delete
      console.log('⏳ Waiting 1 second before reload to ensure backend processed delete...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Reload to ensure fresh state
      console.log('🔄 Reloading page...')
      window.location.reload()
    } catch (error) {
      console.error('❌ Migration failed at step:', error)
      console.error('❌ Error details:', error)
      alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <nav className={`flex-shrink-0 bg-[#4a6c7a] text-white ${isMobile ? 'p-2' : 'p-4'} md:pr-4 pr-16`}>
        <div className="flex items-center justify-between max-w-full">
          <div className="logo relative inline-block flex-shrink-0">
            <div className="relative inline-block bg-[#2d4a56] px-3 py-1" style={{ transform: 'skewX(-12deg)' }}>
              <span 
                className="font-bold italic inline-block text-white"
                style={{ fontSize: isMobile ? '14px' : '24px' }}
              >
                Tig<span className="text-[#4fc3f7] inline-block" style={{ verticalAlign: '-0.1em' }}>≡</span>ment
              </span>
              <span className="text-[10px] absolute -bottom-2 right-3 !bg-white text-[#2d4a56] px-1.5 py-0.6 font-medium hidden md:block">{version}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-1 justify-end ml-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setShowProfile(true)}
                  className={`${isMobile ? 'px-2 py-1' : 'px-4 py-2'} bg-[#4a6c7a] hover:bg-[#3a5c6a] rounded text-sm transition border border-white/20 flex items-center`}
                  style={{ gap: isMobile ? 0 : '0.5rem' }}
                >
                  {user?.profile_picture_url && !avatarLoadFailed ? (
                    <img 
                      src={user.profile_picture_url} 
                      alt="Profile" 
                      className="w-6 h-6 rounded-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <svg 
                        className="w-4 h-4" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                      </svg>
                    </div>
                  )}
                  {!isMobile && <span>{user?.username || user?.email}</span>}
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

      <AdminAnnouncement isMobile={isMobile} />

      <OfflineBanner isPremium={isPremium} onSync={syncNow} />

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

      {/* Migration Dialog for encrypting plaintext data */}
      {showMigrationDialog && (
        <MigrationDialog
          open={showMigrationDialog}
          onDownloadBackup={handleDownloadBackup}
          onSkipBackup={() => {
            console.log('⚠️ User skipped backup before migration')
          }}
          onComplete={handleMigrationComplete}
        />
      )}

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

