import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api, User } from '../utils/api'
import { syncManager, DecryptionFailureError } from '../utils/syncManager'
import { clearAllData } from '../utils/storage'
import { encryptionKeyManager } from '../utils/encryptionKey'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, twoFactorToken?: string) => Promise<any>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isPremium: boolean
  syncNow: () => Promise<void>
  decryptionFailure: { hasFailure: boolean; reason: string | null }
  onDecryptionFailureHandled: () => void
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [decryptionFailure, setDecryptionFailure] = useState<{ hasFailure: boolean; reason: string | null }>({ hasFailure: false, reason: null })
  const [authError, setAuthError] = useState<string | null>(null)

  // Set up auth failure handler on mount
  useEffect(() => {
    api.setAuthFailureHandler(() => {
      console.error('🚨 Authentication failure detected!')
      setAuthError('Your session has expired. Please log in again to continue syncing.')
      setUser(null)
      syncManager.stopAutoSync()
    })
  }, [])

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        if (api.getAccessToken()) {
          console.log('🔐 Access token found, fetching current user...')
          const currentUser = await api.getCurrentUser()
          console.log('👤 Current user loaded:', { id: currentUser.id, email: currentUser.email, username: currentUser.username, profile_picture_url: currentUser.profile_picture_url })
          setUser(currentUser)
          
          // Check if encryption key exists
          if (!syncManager.hasEncryptionKey()) {
            console.warn('⚠️ User authenticated but encryption key not found in session')
            console.warn('⚠️ Sync will not work until user logs in again')
            // The encryption key is lost when browser tab closes (sessionStorage)
            // This is by design for security - password never persists
          } else {
            console.log('✅ Encryption key found in session - sync ready')
            
            // For premium users, do an initial pull to load server data
            const hasActivePremium = currentUser.plan === 'premium' && 
                                     (currentUser.subscription_status === 'active' || currentUser.in_grace_period) &&
                                     (!currentUser.expires_at || (() => {
                                       const expiresAt = new Date(currentUser.expires_at)
                                       const now = new Date()
                                       const gracePeriodDays = 3
                                       const gracePeriodEnd = new Date(expiresAt)
                                       gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)
                                       return now <= gracePeriodEnd
                                     })())
            
            if (hasActivePremium) {
              // Check if we should skip initial sync (e.g., after backup restore)
              const skipInitialSync = sessionStorage.getItem('tigement_skip_initial_sync')
              const backupRestored = sessionStorage.getItem('tigement_backup_restored')
              
              if (skipInitialSync) {
                console.log('⏭️ Skipping initial sync - backup was just restored')
                // Clear the flag immediately after using it (one-time skip)
                sessionStorage.removeItem('tigement_skip_initial_sync')
                console.log('✅ Cleared skip flag - future reloads will sync normally')
              } else if (backupRestored) {
                console.log('📦 Backup was restored - pushing local data to server instead of pulling')
                sessionStorage.removeItem('tigement_backup_restored')
                try {
                  await syncManager.forcePush()
                  console.log('✅ Restored backup data pushed to server successfully')
                } catch (error: any) {
                  console.error('❌ Failed to push restored backup to server:', error)
                }
              } else {
                try {
                  console.log('🔄 Loading server data for authenticated user...')
                  await syncManager.pull()
                  // pull() will reload the page if data exists
                } catch (error: any) {
                  console.error('❌ Initial data load failed:', error)
                  
                  // Check if this is a decryption failure
                  if (error instanceof DecryptionFailureError || error.name === 'DecryptionFailureError') {
                    const failure = syncManager.getDecryptionFailure()
                    setDecryptionFailure(failure)
                    console.log('⚠️ Decryption failure detected')
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Start/stop sync when user auth changes
  useEffect(() => {
    // Check if user has active premium (with grace period)
    const hasActivePremium = user?.plan === 'premium' && 
                             (user?.subscription_status === 'active' || user?.in_grace_period) &&
                             (!user?.expires_at || (() => {
                               const expiresAt = new Date(user.expires_at)
                               const now = new Date()
                               const gracePeriodDays = 3
                               const gracePeriodEnd = new Date(expiresAt)
                               gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)
                               return now <= gracePeriodEnd
                             })())
    
    if (hasActivePremium) {
      // For premium users, start auto-sync with state update callback
      syncManager.startAutoSync({
        onStateUpdate: (data) => {
          // This will be called instead of window.location.reload()
          console.log('🔄 Sync received, triggering custom event to update UI')
          window.dispatchEvent(new CustomEvent('tigement:sync-update', { 
            detail: data 
          }))
        }
      })
    } else {
      syncManager.stopAutoSync()
    }

    return () => {
      syncManager.stopAutoSync()
    }
  }, [user])

  const login = async (email: string, password: string, twoFactorToken?: string, trustDevice?: boolean) => {
    // Get session duration from settings
    const settingsStr = localStorage.getItem('tigement_settings')
    const sessionDays = settingsStr ? JSON.parse(settingsStr).sessionDuration || 7 : 7
    
    // Get existing device token from localStorage
    const existingDeviceToken = localStorage.getItem('tigement_device_token')
    
    const response = await api.login(email, password, twoFactorToken, sessionDays, trustDevice, existingDeviceToken)
    
    // Check if 2FA is required
    if ((response as any).requiresTwoFactor) {
      // Return the response so LoginForm can handle 2FA
      return response
    }
    
    // Store new device token if provided
    if ((response as any).deviceToken) {
      localStorage.setItem('tigement_device_token', (response as any).deviceToken)
      console.log('🔐 Device trusted for 30 days')
    }
    
    setUser(response.user)
    
    // Only set password for encryption if NOT using a custom key
    if (!encryptionKeyManager.isUsingCustomKey()) {
      console.log('🔑 Using login password for encryption')
      syncManager.setPassword(password)
    } else {
      console.log('🔑 Using custom encryption key (not overriding)')
    }
    
    // Initial sync after login for premium users (only if actually active)
    // Check if user has active premium (with grace period consideration)
    const hasActivePremium = response.user.plan === 'premium' && 
                             (response.user.subscription_status === 'active' || response.user.in_grace_period) &&
                             (!response.user.expires_at || (() => {
                               const expiresAt = new Date(response.user.expires_at)
                               const now = new Date()
                               const gracePeriodDays = 3
                               const gracePeriodEnd = new Date(expiresAt)
                               gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)
                               return now <= gracePeriodEnd
                             })())
    
    if (hasActivePremium) {
      const backupRestored = sessionStorage.getItem('tigement_backup_restored')
      
      if (backupRestored) {
        console.log('📦 Backup was restored - pushing local data to server instead of pulling')
        sessionStorage.removeItem('tigement_backup_restored')
        try {
          await syncManager.forcePush()
          console.log('✅ Restored backup data pushed to server successfully')
        } catch (error: any) {
          console.error('❌ Failed to push restored backup to server:', error)
        }
      } else {
      try {
        console.log('🔄 Starting initial sync for premium user...')
        await syncManager.pull()
        // pull() will reload the page if data exists
      } catch (error: any) {
        console.error('❌ Initial sync failed:', error)
        console.error('Error details:', error.message, error.stack)
        
        // Check if this is a decryption failure
        if (error instanceof DecryptionFailureError || error.name === 'DecryptionFailureError') {
          const failure = syncManager.getDecryptionFailure()
          setDecryptionFailure(failure)
          console.log('⚠️ Decryption failure detected, user should be redirected to ProfileMenu')
        }
        // Don't block login if sync fails
        }
      }
    } else if (response.user.plan === 'premium' && response.user.subscription_status === 'expired') {
      console.log('⚠️ Premium subscription expired, sync disabled')
    }
    
    return response
  }

  const register = async (email: string, password: string) => {
    // Get session duration from settings  
    const settingsStr = localStorage.getItem('tigement_settings')
    const sessionDays = settingsStr ? JSON.parse(settingsStr).sessionDuration || 7 : 7
    
    const response = await api.register(email, password, sessionDays)
    setUser(response.user)
    
    // Only set password for encryption if NOT using a custom key
    if (!encryptionKeyManager.isUsingCustomKey()) {
      console.log('🔑 Using login password for encryption')
      syncManager.setPassword(password)
    } else {
      console.log('🔑 Using custom encryption key (not overriding)')
    }
  }

  const logout = async () => {
    // Try to sync before logout if premium user (only if actually active)
    if (isPremium()) {
      try {
        await syncManager.sync()
        console.log('✅ Data synced before logout')
      } catch (error) {
        console.error('⚠️ Sync failed before logout:', error)
        // Ask user for confirmation if sync fails
        const confirmLogout = window.confirm(
          'Cannot sync your data to the server. If you logout now, unsaved changes will be lost.\n\nDo you want to logout anyway?'
        )
        if (!confirmLogout) {
          return // Cancel logout
        }
      }
    }

    // Logout from server
    await api.logout()
    
    // IMPORTANT: Do NOT clear local data - user should keep their data even after logout
    // Only clear sync-related data and stop auto-sync
    syncManager.stopAutoSync()
    syncManager.clearEncryptionKey()
    
    // Clear user state
    setUser(null)
    
    console.log('✅ Logged out (local data preserved)')
  }

  const syncNow = async () => {
    // Check if user has active premium (with grace period)
    if (!isPremium()) {
      throw new Error('Sync is only available for active premium subscriptions')
    }
    
    try {
      await syncManager.sync()
      // Clear decryption failure on successful sync
      const failure = syncManager.getDecryptionFailure()
      if (!failure.hasFailure && decryptionFailure.hasFailure) {
        setDecryptionFailure({ hasFailure: false, reason: null })
      }
    } catch (error: any) {
      if (error instanceof DecryptionFailureError || error.name === 'DecryptionFailureError') {
        const failure = syncManager.getDecryptionFailure()
        setDecryptionFailure(failure)
      }
      throw error
    }
  }

  const onDecryptionFailureHandled = () => {
    // This will be called after user sets custom key or forces overwrite
    const failure = syncManager.getDecryptionFailure()
    setDecryptionFailure(failure)
  }

  // Check for decryption failure on mount and when sync state changes
  useEffect(() => {
    const failure = syncManager.getDecryptionFailure()
    if (failure.hasFailure !== decryptionFailure.hasFailure) {
      setDecryptionFailure(failure)
    }
  }, [decryptionFailure.hasFailure])

  // Check if user has active premium (with grace period consideration)
  const isPremium = (): boolean => {
    if (!user || user.plan !== 'premium' || user.subscription_status !== 'active') {
      return false
    }
    
    // If user is in grace period, still allow premium
    if (user.in_grace_period) {
      return true
    }
    
    // Check expiration date (backend should handle this, but double-check on frontend)
    if (user.expires_at) {
      const expiresAt = new Date(user.expires_at)
      const now = new Date()
      
      // Default grace period is 3 days (should match backend)
      const gracePeriodDays = 3
      const gracePeriodEnd = new Date(expiresAt)
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays)
      
      // If past grace period, not premium
      if (now > gracePeriodEnd) {
        return false
      }
    }
    
    return true
  }

  const clearAuthError = () => setAuthError(null)

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isPremium: isPremium(),
    syncNow,
    decryptionFailure,
    onDecryptionFailureHandled,
    authError,
    clearAuthError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

