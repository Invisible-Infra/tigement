/**
 * API client for backend communication
 */

const API_BASE = '/api'

export interface User {
  id: number
  email: string
  username?: string
  profile_picture_url?: string
  plan?: string
  subscription_status?: string
  is_admin?: boolean
  expires_at?: string
  started_at?: string
  created_at?: string
  in_grace_period?: boolean
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface WorkspaceData {
  data: string | null
  version: number
  updatedAt?: string
}

class ApiClient {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private onAuthFailureCallback: (() => void) | null = null

  constructor() {
    // Load tokens from localStorage
    this.accessToken = localStorage.getItem('accessToken')
    this.refreshToken = localStorage.getItem('refreshToken')
  }

  setAuthFailureHandler(callback: () => void) {
    this.onAuthFailureCallback = callback
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  }

  clearTokens() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  getAccessToken() {
    return this.accessToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Handle token expiration
    if (response.status === 401 && this.refreshToken) {
      // Try to refresh token
      const refreshed = await this.refreshAccessToken()
      if (refreshed) {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`
        const retryResponse = await fetch(url, { ...options, headers })
        if (!retryResponse.ok) {
          throw new Error(`HTTP error! status: ${retryResponse.status}`)
        }
        return retryResponse.json()
      } else {
        // Refresh failed - user is truly logged out
        console.error('🚨 Auth refresh failed - user is logged out')
        if (this.onAuthFailureCallback) {
          this.onAuthFailureCallback()
        }
        throw new Error('Authentication failed. Please log in again.')
      }
    } else if (response.status === 401) {
      // No refresh token or first 401 without retry
      console.error('🚨 401 Unauthorized - session expired')
      if (this.onAuthFailureCallback) {
        this.onAuthFailureCallback()
      }
      throw new Error('Session expired. Please log in again.')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async register(email: string, password: string, sessionDays?: number): Promise<AuthResponse> {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, sessionDays }),
    })
    this.setTokens(response.accessToken, response.refreshToken)
    return response
  }

  async login(email: string, password: string, twoFactorToken?: string, sessionDays?: number, trustDevice?: boolean, deviceToken?: string | null): Promise<AuthResponse | any> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, twoFactorToken, sessionDays, trustDevice, deviceToken }),
    })
    
    // If 2FA is required, return the response without setting tokens
    if (response.requiresTwoFactor) {
      return response
    }
    
    this.setTokens(response.accessToken, response.refreshToken)
    return response
  }

  async refreshAccessToken(): Promise<boolean> {
    try {
      console.log('🔄 Attempting to refresh access token...')
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ Token refresh failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          refreshTokenPresent: !!this.refreshToken,
          refreshTokenLength: this.refreshToken?.length || 0
        })
        this.clearTokens()
        return false
      }

      const data = await response.json()
      this.accessToken = data.accessToken
      localStorage.setItem('accessToken', data.accessToken)
      console.log('✅ Access token refreshed successfully')
      return true
    } catch (error: any) {
      console.error('❌ Token refresh exception:', {
        message: error.message,
        name: error.name,
        refreshTokenPresent: !!this.refreshToken
      })
      this.clearTokens()
      return false
    }
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    })
    this.clearTokens()
  }

  async getCurrentUser(): Promise<User> {
    return this.request('/auth/me')
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    })
  }

  // Workspace endpoints
  async getWorkspace(): Promise<WorkspaceData> {
    return this.request('/workspace')
  }

  async saveWorkspace(encryptedData: string, version: number): Promise<{ success: boolean; version: number }> {
    return this.request('/workspace', {
      method: 'POST',
      body: JSON.stringify({ encryptedData, version }),
    })
  }

  async getWorkspaceVersion(): Promise<{ version: number; updatedAt: string | null }> {
    return this.request('/workspace/version')
  }

  // Migration endpoints
  async getMigrationStatus(): Promise<{ 
    needsMigration: boolean
    plaintextCounts: { notebooks: number; diaries: number; archives: number }
    hasWorkspace: boolean 
  }> {
    return this.request('/migration/status')
  }

  async fetchPlaintextData(): Promise<{
    notebooks: Record<string, string>
    diaries: Record<string, string>
    archives: any[]
  }> {
    return this.request('/migration/fetch-plaintext')
  }

  async deletePlaintextData(): Promise<{ success: boolean }> {
    return this.request('/migration/delete-plaintext', {
      method: 'POST'
    })
  }

  // Admin endpoints
  async getAdminUsers(page: number = 1, limit: number = 20, search: string = ''): Promise<any> {
    return this.request(`/admin/users?page=${page}&limit=${limit}&search=${search}`)
  }

  async getAdminUser(userId: number): Promise<any> {
    return this.request(`/admin/users/${userId}`)
  }

  async setUserPremium(userId: number, premium: boolean, months: number = 12): Promise<any> {
    return this.request(`/admin/users/${userId}/premium`, {
      method: 'PUT',
      body: JSON.stringify({ premium, months }),
    })
  }

  async setUserPremiumExpiry(userId: number, expiresAt: string): Promise<{ success: boolean, message: string }> {
    return this.request(`/admin/users/${userId}/premium-expiry`, {
      method: 'PUT',
      body: JSON.stringify({ expires_at: expiresAt }),
    })
  }

  async createCoupon(code: string, discount_percent: number, valid_until?: string, max_uses?: number): Promise<any> {
    return this.request('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({ code, discount_percent, valid_until, max_uses }),
    })
  }

  async getCoupons(): Promise<any[]> {
    return this.request('/admin/coupons')
  }

  async deleteCoupon(code: string): Promise<any> {
    return this.request(`/admin/coupons/${code}`, {
      method: 'DELETE',
    })
  }

  async getAdminStats(): Promise<any> {
    return this.request('/admin/stats')
  }

  async getUserStats(userId: number): Promise<{ encrypted_data_size: number; last_usage: string | null; last_login: string | null }> {
    return this.request(`/admin/users/${userId}/stats`)
  }

  async deleteUser(userId: number): Promise<{ success: boolean, message: string }> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
  }

  async getPaymentSettings(): Promise<any> {
    return this.request('/admin/payment-settings')
  }

  async updatePaymentSettings(settings: any): Promise<any> {
    return this.request('/admin/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  // User profile endpoints
  async updateProfile(currentPassword: string, email?: string, password?: string): Promise<any> {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, email, password }),
    })
  }

  async updateProfileDisplay(username: string | null, profile_picture_url: string | null): Promise<any> {
    return this.request('/user/profile/display', {
      method: 'PATCH',
      body: JSON.stringify({ username, profile_picture_url }),
    })
  }

  async uploadProfilePicture(file: File): Promise<{ success: boolean; url: string; message: string }> {
    const formData = new FormData()
    formData.append('picture', file)
    
    const token = this.accessToken || localStorage.getItem('accessToken')
    const response = await fetch(`${API_BASE}/user/profile/picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData // Don't set Content-Type, browser will set it with boundary
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }
    
    return response.json()
  }

  async deleteAccount(): Promise<any> {
    return this.request('/user/account', {
      method: 'DELETE',
    })
  }

  // 2FA endpoints
  async setup2FA(): Promise<{ secret: string, qrCode: string, otpauthUrl: string }> {
    return this.request('/2fa/setup', {
      method: 'POST',
    })
  }

  async verify2FA(token: string): Promise<{ success: boolean, backupCodes: string[], message: string }> {
    return this.request('/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  }

  async disable2FA(password: string): Promise<{ success: boolean }> {
    return this.request('/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  }

  async validate2FA(userId: number, token: string): Promise<{ valid: boolean, usedBackupCode?: boolean }> {
    return this.request('/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ userId, token }),
    })
  }

  async get2FAStatus(): Promise<{ enabled: boolean }> {
    return this.request('/2fa/status', {
      method: 'GET',
    })
  }

  // Payment endpoints
  async getPaymentPlans(): Promise<{ monthly: number, halfYearly: number, yearly: number, currency: string }> {
    return this.request('/payment/plans', {
      method: 'GET',
    })
  }

  async validateCoupon(code: string): Promise<{ valid: boolean, discount_percent?: number, code?: string, error?: string }> {
    try {
      return await this.request('/payment/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
    } catch (error: any) {
      return { valid: false, error: error.message || 'Invalid coupon' }
    }
  }

  async createPaymentInvoice(planType: string, couponCode?: string): Promise<{ invoiceId: string, checkoutUrl: string, discountApplied?: number }> {
    return this.request('/payment/create-invoice', {
      method: 'POST',
      body: JSON.stringify({ planType, couponCode }),
    })
  }

  async activateFreePremium(planType: string, couponCode: string): Promise<{ success: boolean, plan: string, expiresAt: string, message: string }> {
    return this.request('/payment/activate-free', {
      method: 'POST',
      body: JSON.stringify({ planType, couponCode }),
    })
  }

  async getPaymentInvoiceStatus(invoiceId: string): Promise<{ status: string }> {
    return this.request(`/payment/status/${invoiceId}`, {
      method: 'GET',
    })
  }

  // iCal endpoints
  async syncCalendar(dayTables: any[]): Promise<{ success: boolean, message: string }> {
    return this.request('/ical/sync', {
      method: 'POST',
      body: JSON.stringify({ dayTables }),
    })
  }

  async generateICalToken(): Promise<{ token: string, url: string }> {
    return this.request('/ical/generate-token', {
      method: 'POST',
    })
  }

  // Notebook endpoints
  async getWorkspaceNotebook(): Promise<{ content: string }> {
    return this.request('/notebooks/workspace', {
      method: 'GET',
    })
  }

  async saveWorkspaceNotebook(content: string): Promise<{ success: boolean }> {
    return this.request('/notebooks/workspace', {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  async getTaskNotebook(taskId: string): Promise<{ content: string }> {
    return this.request(`/notebooks/task/${taskId}`, {
      method: 'GET',
    })
  }

  async saveTaskNotebook(taskId: string, content: string): Promise<{ success: boolean }> {
    return this.request(`/notebooks/task/${taskId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  async deleteTaskNotebook(taskId: string): Promise<{ success: boolean }> {
    return this.request(`/notebooks/task/${taskId}`, {
      method: 'DELETE',
    })
  }

  // Diary endpoints
  async getDiaryEntries(): Promise<Array<{ date: string; preview: string }>> {
    return this.request('/diary/entries', {
      method: 'GET',
    })
  }

  async getDiaryEntry(date: string): Promise<{ content: string }> {
    return this.request(`/diary/entry/${date}`, {
      method: 'GET',
    })
  }

  async saveDiaryEntry(date: string, content: string): Promise<{ success: boolean }> {
    return this.request(`/diary/entry/${date}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  async deleteDiaryEntry(date: string): Promise<{ success: boolean }> {
    return this.request(`/diary/entry/${date}`, {
      method: 'DELETE',
    })
  }

  // Archive endpoints
  async listArchivedTables(): Promise<any[]> {
    return this.request('/archives', {
      method: 'GET',
    })
  }

  async archiveTable(table: any): Promise<{ id: number }> {
    return this.request('/archives', {
      method: 'POST',
      body: JSON.stringify(table),
    })
  }

  async restoreArchivedTable(id: number): Promise<any> {
    return this.request(`/archives/${id}/restore`, {
      method: 'POST',
    })
  }

  async deleteArchivedTable(id: number): Promise<{ success: boolean }> {
    return this.request(`/archives/${id}`, {
      method: 'DELETE',
    })
  }

  async getVersion(): Promise<{ version: string }> {
    const response = await fetch(`${API_BASE}/version`)
    if (!response.ok) {
      throw new Error('Failed to fetch version')
    }
    return response.json()
  }

  async reportBug(description: string, severity: 'Normal' | 'Severe' | 'Critical', githubHandle?: string, postAnonymously?: boolean, logs?: string): Promise<{ success: boolean; message: string; githubIssueUrl?: string }> {
    return this.request('/bugs/report', {
      method: 'POST',
      body: JSON.stringify({ description, severity, githubHandle, postAnonymously, logs }),
    })
  }

  async requestFeature(description: string, priority: 'Nice to have' | 'Need' | 'Just an idea', githubHandle?: string, name?: string, postAnonymously?: boolean): Promise<{ success: boolean; message: string; githubIssueUrl?: string }> {
    return this.request('/bugs/feature-request', {
      method: 'POST',
      body: JSON.stringify({ description, priority, githubHandle, name, postAnonymously }),
    })
  }

  // OAuth passphrase setup
  async setOAuthPassphrase(oauthToken: string, passphrase: string, isNew: boolean): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    return this.request('/auth/oauth/passphrase', {
      method: 'POST',
      body: JSON.stringify({ oauthToken, passphrase, isNew }),
    })
  }

  // Reset OAuth passphrase (deletes encrypted data)
  async resetOAuthPassphrase(oauthToken: string): Promise<{ success: boolean }> {
    return this.request('/auth/oauth/reset-passphrase', {
      method: 'POST',
      body: JSON.stringify({ oauthToken }),
    })
  }

  // Get available OAuth providers
  async getOAuthProviders(): Promise<{ providers: { github: boolean; google: boolean; apple: boolean; twitter: boolean; facebook: boolean } }> {
    return this.request('/auth/oauth/providers', {
      method: 'GET',
    })
  }

  // Payment methods
  async getPaymentMethods(): Promise<any[]> {
    return this.request('/payment/methods', {
      method: 'GET',
    })
  }

  async createPaymentInvoiceMulti(planType: string, paymentMethod?: string, couponCode?: string): Promise<any> {
    return this.request('/payment/create-invoice-multi', {
      method: 'POST',
      body: JSON.stringify({ planType, paymentMethod, couponCode }),
    })
  }

  async capturePayPalPayment(orderId: string): Promise<any> {
    return this.request(`/payment/paypal/capture/${orderId}`, {
      method: 'POST',
    })
  }

  // Referral coupons
  async claimReferralCoupons(): Promise<{ success: boolean; coupons: any[]; totalGenerated: number; monthsPerCoupon: number }> {
    return this.request('/coupons/claim', {
      method: 'POST',
    })
  }

  async getMyCoupons(): Promise<{ coupons: any[]; allocation: { allocated: number; claimed: number; available: number } }> {
    return this.request('/coupons/my-coupons', {
      method: 'GET',
    })
  }

  async getCouponStatistics(): Promise<{ totalGenerated: number; totalUsed: number; activeCount: number; totalMonthsGranted: number; conversionRate: string }> {
    return this.request('/coupons/statistics', {
      method: 'GET',
    })
  }

  // Admin: Payment methods
  async getAdminPaymentMethods(): Promise<any[]> {
    return this.request('/admin/payment-methods', {
      method: 'GET',
    })
  }

  async updatePaymentMethod(methodId: number, updates: any): Promise<{ success: boolean; message: string }> {
    return this.request(`/admin/payment-methods/${methodId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // Admin: Coupon settings
  async getCouponSettings(): Promise<any> {
    return this.request('/admin/coupon-settings', {
      method: 'GET',
    })
  }

  async updateCouponSettings(settings: any): Promise<{ success: boolean; message: string }> {
    return this.request('/admin/coupon-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }

  async getUserCouponAllocation(userId: number): Promise<any> {
    return this.request(`/admin/users/${userId}/coupon-allocation`, {
      method: 'GET',
    })
  }

  async updateUserCouponAllocation(userId: number, allocation: any): Promise<{ success: boolean; message: string }> {
    return this.request(`/admin/users/${userId}/coupon-allocation`, {
      method: 'PUT',
      body: JSON.stringify(allocation),
    })
  }

  // Announcements
  async getAnnouncement(): Promise<any> {
    return this.request('/announcements/current')
  }

  async getAdminAnnouncement(): Promise<any> {
    return this.request('/admin/announcement')
  }

  async updateAnnouncement(data: { message: string; text_color: string; background_color: string; enabled: boolean }): Promise<any> {
    return this.request('/admin/announcement', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async getDebugSettings(): Promise<{ debug_button_enabled: boolean }> {
    return this.request('/admin/debug-settings')
  }

  async updateDebugSettings(data: { debug_button_enabled: boolean }): Promise<any> {
    return this.request('/admin/debug-settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  // API Token Management
  async generateApiToken(data: { name: string; scopes: string[]; canDecrypt: boolean; expiresInDays?: number }): Promise<any> {
    const { canDecrypt, ...rest } = data;
    
    let payload: any = {
      ...rest,
      enableDecryption: canDecrypt,
    };
    
    // If decryption is enabled, include the encryption key
    if (canDecrypt) {
      // Get encryption key from encryptionKeyManager
      const { encryptionKeyManager } = await import('./encryptionKey');
      const encryptionKey = encryptionKeyManager.getKey();
      
      if (!encryptionKey) {
        throw new Error('Encryption key not available. Please log in first.');
      }
      
      payload.encryptionKey = encryptionKey;
    }
    
    return this.request('/tokens/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async listApiTokens(): Promise<{ tokens: any[] }> {
    return this.request('/tokens', {
      method: 'GET',
    })
  }

  async getApiToken(id: number): Promise<any> {
    return this.request(`/tokens/${id}`, {
      method: 'GET',
    })
  }

  async revokeApiToken(id: number): Promise<{ success: boolean; message: string }> {
    return this.request(`/tokens/${id}`, {
      method: 'DELETE',
    })
  }

  // Encryption key rotation
  async rotateEncryptionKey(invalidateTokens: boolean = true): Promise<any> {
    return this.request('/user/rotate-encryption-key', {
      method: 'POST',
      body: JSON.stringify({ invalidateTokens }),
    })
  }
}

export const api = new ApiClient()

