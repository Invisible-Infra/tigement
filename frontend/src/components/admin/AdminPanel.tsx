import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateWithSettings } from '../../utils/dateFormat'

interface AdminPanelProps {
  onClose: () => void
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'coupons' | 'stats' | 'payment' | 'payment-methods' | 'referral-coupons' | 'announcements' | 'onboarding' | 'debugging'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedUserStats, setSelectedUserStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [editingUserExpiry, setEditingUserExpiry] = useState<{userId: number, currentExpiry: string | null} | null>(null)
  const [newExpiryDate, setNewExpiryDate] = useState('')

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [paymentMethodsSaved, setPaymentMethodsSaved] = useState(false)

  // Referral coupon settings state
  const [couponSettings, setCouponSettings] = useState<any>({
    referral_system_enabled: false,
    coupons_per_purchase: 3,
    months_per_coupon: 1,
    allow_user_overrides: false
  })
  const [couponSettingsSaved, setCouponSettingsSaved] = useState(false)

  // Announcement state
  const [announcement, setAnnouncement] = useState({
    message: '',
    text_color: '#000000',
    background_color: '#fef3c7',
    enabled: false
  })
  const [announcementSaved, setAnnouncementSaved] = useState(false)

  // Debugging settings state
  const [debugSettings, setDebugSettings] = useState({
    debug_button_enabled: false
  })
  const [debugSettingsSaved, setDebugSettingsSaved] = useState(false)

  const [onboardingSettings, setOnboardingSettings] = useState({ onboarding_video_url: '' })
  const [onboardingSettingsSaved, setOnboardingSettingsSaved] = useState(false)

  // Coupon form
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_percent: 10,
    valid_until: '',
    max_uses: '',
  })

  // Payment settings
  const [paymentSettings, setPaymentSettings] = useState({
    btcpay_url: '',
    btcpay_store_id: '',
    btcpay_api_key: '',
    btcpay_webhook_secret: '',
    premium_monthly_price: 9.99,
    premium_yearly_price: 99.99,
    currency: 'USD',
    premium_grace_period_days: 3
  })
  const [paymentSaved, setPaymentSaved] = useState(false)

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    } else if (activeTab === 'coupons') {
      loadCoupons()
    } else if (activeTab === 'stats') {
      loadStats()
    } else if (activeTab === 'payment') {
      loadPaymentSettings()
    } else if (activeTab === 'payment-methods') {
      loadPaymentMethods()
    } else if (activeTab === 'referral-coupons') {
      loadCouponSettings()
    } else if (activeTab === 'announcements') {
      loadAnnouncement()
    } else if (activeTab === 'onboarding') {
      loadOnboardingSettings()
    } else if (activeTab === 'debugging') {
      loadDebugSettings()
    }
  }, [activeTab, page, search])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await api.getAdminUsers(page, 20, search)
      setUsers(data.users)
      setTotalUsers(data.total)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const data = await api.getCoupons()
      setCoupons(data)
    } catch (error) {
      console.error('Failed to load coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const data = await api.getAdminStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentSettings = async () => {
    setLoading(true)
    try {
      const data = await api.getPaymentSettings()
      setPaymentSettings(data)
    } catch (error) {
      console.error('Failed to load payment settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentMethods = async () => {
    setLoading(true)
    try {
      const data = await api.getAdminPaymentMethods()
      setPaymentMethods(data)
    } catch (error) {
      console.error('Failed to load payment methods:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCouponSettings = async () => {
    setLoading(true)
    try {
      const data = await api.getCouponSettings()
      setCouponSettings(data)
    } catch (error) {
      console.error('Failed to load coupon settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePaymentSettings = async () => {
    setLoading(true)
    try {
      await api.updatePaymentSettings(paymentSettings)
      setPaymentSaved(true)
      setTimeout(() => setPaymentSaved(false), 3000)
      alert('Payment settings saved successfully!')
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const savePaymentMethod = async (method: any) => {
    try {
      await api.updatePaymentMethod(method.id, method)
      setPaymentMethodsSaved(true)
      setTimeout(() => setPaymentMethodsSaved(false), 2000)
      loadPaymentMethods()
    } catch (error: any) {
      alert(`Failed to save payment method: ${error.message}`)
    }
  }

  const saveCouponSettings = async () => {
    setLoading(true)
    try {
      await api.updateCouponSettings(couponSettings)
      setCouponSettingsSaved(true)
      setTimeout(() => setCouponSettingsSaved(false), 3000)
      alert('Coupon settings saved successfully!')
      loadCouponSettings()
    } catch (error: any) {
      alert(`Failed to save coupon settings: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadAnnouncement = async () => {
    setLoading(true)
    try {
      const data = await api.getAdminAnnouncement()
      setAnnouncement(data)
    } catch (error) {
      console.error('Failed to load announcement:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveAnnouncement = async () => {
    setLoading(true)
    try {
      await api.updateAnnouncement(announcement)
      setAnnouncementSaved(true)
      setTimeout(() => setAnnouncementSaved(false), 3000)
      alert('Announcement saved successfully!')
    } catch (error: any) {
      alert(`Failed to save announcement: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadDebugSettings = async () => {
    setLoading(true)
    try {
      const data = await api.getDebugSettings()
      setDebugSettings(data)
    } catch (error) {
      console.error('Failed to load debug settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveDebugSettings = async () => {
    setLoading(true)
    try {
      await api.updateDebugSettings(debugSettings)
      setDebugSettingsSaved(true)
      setTimeout(() => setDebugSettingsSaved(false), 3000)
      alert('Debug settings saved successfully!')
    } catch (error: any) {
      alert(`Failed to save debug settings: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadOnboardingSettings = async () => {
    setLoading(true)
    try {
      const data = await api.getOnboardingSettings()
      setOnboardingSettings(data)
    } catch (error) {
      console.error('Failed to load onboarding settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveOnboardingSettings = async () => {
    setLoading(true)
    try {
      await api.updateOnboardingSettings(onboardingSettings)
      setOnboardingSettingsSaved(true)
      setTimeout(() => setOnboardingSettingsSaved(false), 3000)
      alert('Onboarding settings saved successfully!')
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const togglePremium = async (userId: number, currentPlan: string, subscriptionStatus?: string) => {
    const isExpired = currentPlan === 'premium' && subscriptionStatus === 'expired'
    const action = isExpired ? 'Renew' : (currentPlan === 'premium' ? 'Revoke' : 'Grant')
    
    if (!confirm(`${action} premium for this user?`)) {
      return
    }

    try {
      // Grant premium if user doesn't have it OR if expired
      const grantPremium = currentPlan !== 'premium' || isExpired
      await api.setUserPremium(userId, grantPremium)
      loadUsers()
    } catch (error: any) {
      alert(`Failed: ${error.message}`)
    }
  }

  const setUserExpiry = async (userId: number, expiryDate: string) => {
    try {
      await api.setUserPremiumExpiry(userId, expiryDate)
      alert('Premium expiration updated!')
      setEditingUserExpiry(null)
      setNewExpiryDate('')
      loadUsers()
    } catch (error: any) {
      alert('Failed to update expiration: ' + error.message)
    }
  }

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    if (!confirm(`⚠️ DELETE USER AND ALL DATA?\n\nUser: ${userEmail}\n\nThis will permanently delete:\n- User account\n- All tasks and tables\n- Workspace data\n- Subscription info\n- Payment history\n\nThis action CANNOT be undone!`)) {
      return
    }

    // Double confirmation
    if (!confirm(`Are you absolutely sure you want to delete ${userEmail}?\n\nType 'DELETE' in the next prompt to confirm.`)) {
      return
    }

    const confirmation = prompt('Type DELETE to confirm:')
    if (confirmation !== 'DELETE') {
      alert('Deletion cancelled.')
      return
    }

    try {
      const result = await api.deleteUser(userId)
      alert(result.message || 'User deleted successfully')
      loadUsers()
      loadStats()
    } catch (error: any) {
      alert(`Failed to delete user: ${error.message}`)
    }
  }

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createCoupon(
        newCoupon.code,
        newCoupon.discount_percent,
        newCoupon.valid_until || undefined,
        newCoupon.max_uses ? parseInt(newCoupon.max_uses) : undefined
      )
      setNewCoupon({ code: '', discount_percent: 10, valid_until: '', max_uses: '' })
      loadCoupons()
    } catch (error: any) {
      alert(`Failed: ${error.message}`)
    }
  }

  const deleteCoupon = async (code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) {
      return
    }

    try {
      await api.deleteCoupon(code)
      loadCoupons()
    } catch (error: any) {
      alert(`Failed: ${error.message}`)
    }
  }

  const loadUserStats = async (userId: number) => {
    setLoadingStats(true)
    try {
      const [stats, payments, coupons] = await Promise.all([
        api.getUserStats(userId),
        api.getUserPayments(userId),
        api.getUserCouponsUsed(userId)
      ])

      setSelectedUserStats({
        userId,
        ...stats,
        payments: payments.payments,
        paymentSummary: payments.summary,
        couponUsages: coupons.usages,
        couponSummary: coupons.summary
      })
    } catch (error: any) {
      alert(`Failed to load stats: ${error.message}`)
      setSelectedUserStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <button onClick={onClose} className="text-2xl hover:text-gray-300">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium ${activeTab === 'users' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-6 py-3 font-medium ${activeTab === 'coupons' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Coupons
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 font-medium ${activeTab === 'stats' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`px-6 py-3 font-medium ${activeTab === 'payment' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Payment Settings
          </button>
          <button
            onClick={() => setActiveTab('payment-methods')}
            className={`px-6 py-3 font-medium ${activeTab === 'payment-methods' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Payment Methods
          </button>
          <button
            onClick={() => setActiveTab('referral-coupons')}
            className={`px-6 py-3 font-medium ${activeTab === 'referral-coupons' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            Referral Coupons
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-6 py-3 font-medium ${activeTab === 'announcements' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            📢 Announcements
          </button>
          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-6 py-3 font-medium ${activeTab === 'onboarding' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            🎓 Onboarding
          </button>
          <button
            onClick={() => setActiveTab('debugging')}
            className={`px-6 py-3 font-medium ${activeTab === 'debugging' ? 'border-b-2 border-[#4fc3f7] text-[#4fc3f7]' : 'text-gray-600'}`}
          >
            🐛 Debugging
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && <div className="text-center py-8">Loading...</div>}

          {/* Users Tab */}
          {activeTab === 'users' && !loading && (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                />
              </div>

              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Plan</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Started</th>
                    <th className="px-4 py-2 text-left">Expires</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {u.email}
                        {u.is_admin && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">ADMIN</span>}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${u.plan === 'premium' ? 'bg-yellow-200' : 'bg-gray-200'}`}>
                          {u.plan || 'free'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {u.subscription_status || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {formatDateWithSettings(u.started_at || u.created_at)}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {u.expires_at ? (
                          <span className={new Date(u.expires_at) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                            {formatDateWithSettings(u.expires_at)}
                            {new Date(u.expires_at) < new Date() && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => loadUserStats(u.id)}
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                            title="View user statistics"
                          >
                            📊 Stats
                          </button>
                          {u.plan === 'premium' && u.subscription_status !== 'expired' ? (
                            <>
                              <button
                                onClick={() => setEditingUserExpiry({userId: u.id, currentExpiry: u.expires_at})}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                              >
                                Set Expiry
                              </button>
                              <button
                                onClick={() => togglePremium(u.id, u.plan, u.subscription_status)}
                                disabled={u.is_admin}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-30"
                              >
                                Revoke
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingUserExpiry({userId: u.id, currentExpiry: null})}
                              disabled={u.is_admin}
                              className="px-3 py-1 bg-[#4fc3f7] text-white rounded hover:bg-[#3ba3d7] text-sm disabled:opacity-30"
                            >
                              {u.plan === 'premium' && u.subscription_status === 'expired' ? 'Renew' : 'Grant'} Premium
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={u.is_admin}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm disabled:opacity-30"
                            title={u.is_admin ? 'Cannot delete admin users' : 'Delete user and all data'}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="mt-4 flex justify-between items-center">
                <div>Total: {totalUsers} users</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">Page {page}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={users.length < 20}
                    className="px-3 py-1 border rounded disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Coupons Tab */}
          {activeTab === 'coupons' && !loading && (
            <div>
              {/* Create Coupon Form */}
              <form onSubmit={createCoupon} className="mb-6 bg-gray-50 p-4 rounded">
                <h3 className="font-bold mb-3">Create New Coupon</h3>
                <div className="grid grid-cols-4 gap-4">
                  <input
                    type="text"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
                    placeholder="Code (e.g. SAVE20)"
                    required
                    className="px-3 py-2 border rounded"
                  />
                  <input
                    type="number"
                    value={newCoupon.discount_percent}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discount_percent: parseInt(e.target.value) })}
                    placeholder="Discount %"
                    min="1"
                    max="100"
                    required
                    className="px-3 py-2 border rounded"
                  />
                  <input
                    type="date"
                    value={newCoupon.valid_until}
                    onChange={(e) => setNewCoupon({ ...newCoupon, valid_until: e.target.value })}
                    placeholder="Valid Until"
                    className="px-3 py-2 border rounded"
                  />
                  <input
                    type="number"
                    value={newCoupon.max_uses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
                    placeholder="Max Uses"
                    className="px-3 py-2 border rounded"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Create Coupon
                </button>
              </form>

              {/* Coupons List */}
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Discount</th>
                    <th className="px-4 py-2 text-left">Valid Until</th>
                    <th className="px-4 py-2 text-left">Usage</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono font-bold">{c.code}</td>
                      <td className="px-4 py-2">{c.discount_percent}%</td>
                      <td className="px-4 py-2">
                        {c.valid_until ? formatDateWithSettings(c.valid_until) : 'No expiry'}
                      </td>
                      <td className="px-4 py-2">
                        {c.current_uses} / {c.max_uses || '∞'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => deleteCoupon(c.code)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && !loading && stats && (
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{stats.total_users}</div>
                <div className="text-gray-600 mt-2">Total Users</div>
              </div>
              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{stats.premium_users}</div>
                <div className="text-gray-600 mt-2">Premium Users</div>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{stats.active_coupons}</div>
                <div className="text-gray-600 mt-2">Active Coupons</div>
              </div>
            </div>
          )}

          {/* Payment Settings Tab */}
          {activeTab === 'payment' && !loading && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold mb-6">BTC Pay Server Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BTC Pay Server URL
                  </label>
                  <input
                    type="url"
                    value={paymentSettings.btcpay_url || ''}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, btcpay_url: e.target.value })}
                    placeholder="https://btcpay.example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your BTC Pay Server instance URL</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store ID
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.btcpay_store_id || ''}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, btcpay_store_id: e.target.value })}
                    placeholder="Your store ID from BTC Pay"
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.btcpay_api_key || ''}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, btcpay_api_key: e.target.value })}
                    placeholder="API key from BTC Pay Server"
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">Generate in BTC Pay: Account → API Keys</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={paymentSettings.btcpay_webhook_secret || ''}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, btcpay_webhook_secret: e.target.value })}
                    placeholder="Webhook secret from BTC Pay"
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">From BTC Pay: Store Settings → Webhooks</p>
                </div>

                <div className="border-t pt-4 mt-6">
                  <h3 className="text-lg font-semibold mb-4">Subscription Pricing</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monthly Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentSettings.premium_monthly_price}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, premium_monthly_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        6-Month Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentSettings.premium_half_yearly_price || (paymentSettings.premium_monthly_price * 6 * 0.85)}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, premium_half_yearly_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded"
                        placeholder="Auto: Monthly × 6 × 0.85"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for auto-calculation (15% discount)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Yearly Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentSettings.premium_yearly_price}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, premium_yearly_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={paymentSettings.currency}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, currency: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="BTC">BTC - Bitcoin</option>
                    </select>
                  </div>

                  <div className="border-t pt-4 mt-6">
                    <h3 className="text-lg font-semibold mb-4">Premium Grace Period</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grace Period (days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={paymentSettings.premium_grace_period_days || 3}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, premium_grace_period_days: parseInt(e.target.value) || 3 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Number of days after expiration that premium features remain active. Default: 3 days.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    onClick={savePaymentSettings}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                  {paymentSaved && (
                    <span className="text-green-600 flex items-center">
                      ✓ Saved successfully
                    </span>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold text-blue-900 mb-2">📖 Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Create account on your BTC Pay Server</li>
                    <li>Create a store in BTC Pay</li>
                    <li>Generate API key with invoice permissions</li>
                    <li>Setup webhook pointing to: <code className="bg-blue-100 px-1 rounded">your-domain.com/api/payment/webhook</code></li>
                    <li>Enter all credentials above and save</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'payment-methods' && !loading && (
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold mb-6">Payment Methods Management</h2>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Enable multiple payment methods to give users more choices. You can set per-method discounts to incentivize specific payment types.
                </p>
              </div>

              {paymentMethodsSaved && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4 text-green-800">
                  ✓ Payment method settings saved successfully!
                </div>
              )}

              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="border-2 rounded-lg p-6 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold capitalize">
                          {method.method_name === 'btcpay' ? 'BTC Pay' : method.method_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {method.method_name === 'btcpay' && 'Bitcoin and cryptocurrency payments'}
                          {method.method_name === 'stripe' && 'Credit/debit cards via Stripe'}
                          {method.method_name === 'paypal' && 'PayPal and PayPal balance'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={method.enabled}
                          onChange={(e) => {
                            const updated = { ...method, enabled: e.target.checked }
                            setPaymentMethods(paymentMethods.map(m => m.id === method.id ? updated : m))
                            savePaymentMethod(updated)
                          }}
                          className="w-6 h-6"
                        />
                        <span className="font-medium">{method.enabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>

                    {method.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Order
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={method.display_order}
                            onChange={(e) => {
                              const updated = { ...method, display_order: parseInt(e.target.value) || 1 }
                              setPaymentMethods(paymentMethods.map(m => m.id === method.id ? updated : m))
                            }}
                            onBlur={() => savePaymentMethod(method)}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={method.discount_percent || 0}
                            onChange={(e) => {
                              const updated = { ...method, discount_percent: parseFloat(e.target.value) || 0 }
                              setPaymentMethods(paymentMethods.map(m => m.id === method.id ? updated : m))
                            }}
                            onBlur={() => savePaymentMethod(method)}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">e.g., 5 for 5% off</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Discount ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={method.discount_amount || 0}
                            onChange={(e) => {
                              const updated = { ...method, discount_amount: parseFloat(e.target.value) || 0 }
                              setPaymentMethods(paymentMethods.map(m => m.id === method.id ? updated : m))
                            }}
                            onBlur={() => savePaymentMethod(method)}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">Fixed amount off</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg mt-6">
                <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Configuration Notes</h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li><strong>BTC Pay:</strong> Configure in "Payment Settings" tab</li>
                  <li><strong>Stripe:</strong> Add STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET to .env</li>
                  <li><strong>PayPal:</strong> Add PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE to .env</li>
                  <li>Restart backend after adding credentials</li>
                </ul>
              </div>
            </div>
          )}

          {/* Referral Coupons Settings Tab */}
          {activeTab === 'referral-coupons' && !loading && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-6">Referral Coupon System</h2>
              
              <div className="bg-purple-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-purple-800">
                  💡 <strong>How it works:</strong> When users purchase Premium, they earn referral coupons they can share with friends or sell. Each coupon grants free Premium.
                </p>
              </div>

              {couponSettingsSaved && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4 text-green-800">
                  ✓ Coupon settings saved successfully!
                </div>
              )}

              <div className="space-y-6">
                {/* Enable/Disable System */}
                <div className="border-2 rounded-lg p-6 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Referral System Status</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Enable or disable the referral coupon generation system
                      </p>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={couponSettings.referral_system_enabled}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            const shouldInvalidate = confirm(
                              'Disable referral system?\n\n' +
                              'Choose OK to invalidate all existing referral coupons.\n' +
                              'Choose Cancel to just stop generating new coupons.'
                            )
                            setCouponSettings({
                              ...couponSettings,
                              referral_system_enabled: false,
                              invalidate_existing: shouldInvalidate
                            })
                          } else {
                            setCouponSettings({ ...couponSettings, referral_system_enabled: true })
                          }
                        }}
                        className="w-6 h-6"
                      />
                      <span className="font-medium">
                        {couponSettings.referral_system_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Global Settings */}
                <div className="border-2 rounded-lg p-6 bg-white">
                  <h3 className="text-lg font-bold mb-4">Global Coupon Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Coupons Per Purchase
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={couponSettings.coupons_per_purchase}
                        onChange={(e) => setCouponSettings({
                          ...couponSettings,
                          coupons_per_purchase: parseInt(e.target.value) || 0
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                        disabled={!couponSettings.referral_system_enabled}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        How many coupons users get when they purchase Premium
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Months Per Coupon
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={couponSettings.months_per_coupon}
                        onChange={(e) => setCouponSettings({
                          ...couponSettings,
                          months_per_coupon: parseInt(e.target.value) || 1
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                        disabled={!couponSettings.referral_system_enabled}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        How many months of Premium each coupon grants
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={couponSettings.allow_user_overrides}
                        onChange={(e) => setCouponSettings({
                          ...couponSettings,
                          allow_user_overrides: e.target.checked
                        })}
                        className="w-5 h-5"
                        disabled={!couponSettings.referral_system_enabled}
                      />
                      <span className="text-sm font-medium">Allow per-user overrides</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-7">
                      Enable custom coupon allocations for specific users (managed in Users tab)
                    </p>
                  </div>
                </div>

                {/* Example */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">📋 Example</h4>
                  <p className="text-sm text-gray-700">
                    With current settings: When a user purchases Premium, they will receive{' '}
                    <strong>{couponSettings.coupons_per_purchase} coupon{couponSettings.coupons_per_purchase !== 1 ? 's' : ''}</strong>.
                    Each coupon can be redeemed for{' '}
                    <strong>{couponSettings.months_per_coupon} month{couponSettings.months_per_coupon !== 1 ? 's' : ''}</strong> of Premium.
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex gap-4">
                  <button
                    onClick={saveCouponSettings}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Announcements Tab */}
          {activeTab === 'announcements' && !loading && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-6">📢 Admin Announcements</h2>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Info:</strong> Create announcements visible to all users at the top of the app. Updates appear within 60 seconds without page reload.
                </p>
              </div>

              {announcementSaved && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4 text-green-800">
                  ✓ Announcement saved successfully!
                </div>
              )}

              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="border-2 rounded-lg p-6 bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">Announcement Status</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Enable to show announcement to all users
                      </p>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={announcement.enabled}
                        onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })}
                        className="w-6 h-6"
                      />
                      <span className="font-medium">
                        {announcement.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {/* Message Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Announcement Message
                    </label>
                    <textarea
                      value={announcement.message}
                      onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Enter your announcement message..."
                    />
                  </div>

                  {/* Color Pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Text Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={announcement.text_color}
                          onChange={(e) => setAnnouncement({ ...announcement, text_color: e.target.value })}
                          className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={announcement.text_color}
                          onChange={(e) => setAnnouncement({ ...announcement, text_color: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded"
                          placeholder="#000000"
                          pattern="^#[0-9A-Fa-f]{6}$"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Background Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={announcement.background_color}
                          onChange={(e) => setAnnouncement({ ...announcement, background_color: e.target.value })}
                          className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={announcement.background_color}
                          onChange={(e) => setAnnouncement({ ...announcement, background_color: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded"
                          placeholder="#fef3c7"
                          pattern="^#[0-9A-Fa-f]{6}$"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  {announcement.message && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Preview:</h4>
                      <div 
                        className="px-4 py-3 text-sm text-center font-medium border rounded"
                        style={{
                          color: announcement.text_color,
                          backgroundColor: announcement.background_color
                        }}
                      >
                        {announcement.message}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex gap-4">
                  <button
                    onClick={saveAnnouncement}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Announcement'}
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3">🎨 Quick Presets</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onClick={() => setAnnouncement({
                        ...announcement,
                        text_color: '#1e3a8a',
                        background_color: '#dbeafe'
                      })}
                      className="px-3 py-2 text-xs border rounded"
                      style={{ color: '#1e3a8a', backgroundColor: '#dbeafe' }}
                    >
                      Info (Blue)
                    </button>
                    <button
                      onClick={() => setAnnouncement({
                        ...announcement,
                        text_color: '#166534',
                        background_color: '#dcfce7'
                      })}
                      className="px-3 py-2 text-xs border rounded"
                      style={{ color: '#166534', backgroundColor: '#dcfce7' }}
                    >
                      Success (Green)
                    </button>
                    <button
                      onClick={() => setAnnouncement({
                        ...announcement,
                        text_color: '#9a3412',
                        background_color: '#fed7aa'
                      })}
                      className="px-3 py-2 text-xs border rounded"
                      style={{ color: '#9a3412', backgroundColor: '#fed7aa' }}
                    >
                      Warning (Orange)
                    </button>
                    <button
                      onClick={() => setAnnouncement({
                        ...announcement,
                        text_color: '#991b1b',
                        background_color: '#fee2e2'
                      })}
                      className="px-3 py-2 text-xs border rounded"
                      style={{ color: '#991b1b', backgroundColor: '#fee2e2' }}
                    >
                      Alert (Red)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onboarding Tab */}
          {activeTab === 'onboarding' && !loading && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-6">🎓 Onboarding Settings</h2>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  💡 <strong>Info:</strong> Configure the welcome modal video shown to new users on first run. Leave empty to hide the video or fall back to <code className="bg-blue-100 px-1 rounded">VITE_ONBOARDING_VIDEO_URL</code> from .env.
                </p>
              </div>

              {onboardingSettingsSaved && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4 text-green-800">
                  ✓ Onboarding settings saved successfully!
                </div>
              )}

              <div className="space-y-6">
                <div className="border-2 rounded-lg p-6 bg-white">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Onboarding Video URL
                    </label>
                    <input
                      type="url"
                      value={onboardingSettings.onboarding_video_url || ''}
                      onChange={(e) => setOnboardingSettings({ ...onboardingSettings, onboarding_video_url: e.target.value })}
                      placeholder="https://example.com/onboarding-video.mp4"
                      className="w-full px-4 py-2 border border-gray-300 rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      YouTube link (watch or youtu.be), direct .mp4/.webm URL, or leave empty to disable
                    </p>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={saveOnboardingSettings}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debugging Tab */}
          {activeTab === 'debugging' && !loading && (
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-6">🐛 Debugging Settings</h2>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  Control debugging features visible to users for diagnostics and troubleshooting.
                </p>
              </div>

              {debugSettingsSaved && (
                <div className="bg-green-50 border border-green-200 p-4 rounded mb-4 text-green-800">
                  ✓ Debug settings saved successfully!
                </div>
              )}

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="space-y-6">
                  {/* Debug Button Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">Debug Button</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Show red DEBUG button in bottom-right corner that allows users to export console logs for troubleshooting
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={debugSettings.debug_button_enabled}
                      onChange={(e) => setDebugSettings({ ...debugSettings, debug_button_enabled: e.target.checked })}
                      className="w-6 h-6"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex gap-4 pt-4 border-t">
                    <button
                      onClick={saveDebugSettings}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Debug Settings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Stats Modal */}
      {selectedUserStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">User Statistics</h3>
              <button
                onClick={() => setSelectedUserStats(null)}
                className="text-2xl hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {loadingStats ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm text-gray-600 mb-1">Encrypted Data Size</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {formatBytes(selectedUserStats.encrypted_data_size || 0)}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm text-gray-600 mb-1">Last Login</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {selectedUserStats.last_login
                      ? formatDateWithSettings(selectedUserStats.last_login)
                      : 'Never'}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <div className="text-sm text-gray-600 mb-1">Last Usage</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {selectedUserStats.last_usage
                      ? formatDateWithSettings(selectedUserStats.last_usage)
                      : 'Never'}
                  </div>
                </div>

                {/* Payment summary & history */}
                <div className="bg-gray-50 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Payments</div>
                      <p className="text-xs text-gray-500">
                        Includes payment and coupon history for this user.
                      </p>
                    </div>
                    {selectedUserStats.paymentSummary && (
                      <div className="text-right text-sm text-gray-700">
                        <div>
                          Total paid:{' '}
                          <span className="font-semibold">
                            {selectedUserStats.paymentSummary.currency || ''}{' '}
                            {(selectedUserStats.paymentSummary.total_paid || 0).toFixed
                              ? selectedUserStats.paymentSummary.total_paid.toFixed(2)
                              : selectedUserStats.paymentSummary.total_paid || 0}
                          </span>
                        </div>
                        {selectedUserStats.paymentSummary.last_payment_at && (
                          <div>
                            Last payment:{' '}
                            {formatDateWithSettings(
                              selectedUserStats.paymentSummary.last_payment_at
                            )}
                          </div>
                        )}
                        {selectedUserStats.paymentSummary.current_expires_at && (
                          <div>
                            Current expiry:{' '}
                            {formatDateWithSettings(
                              selectedUserStats.paymentSummary.current_expires_at
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedUserStats.payments && selectedUserStats.payments.length > 0 ? (
                    <div className="max-h-60 overflow-auto border border-gray-200 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Date</th>
                            <th className="px-2 py-1 text-left">Method</th>
                            <th className="px-2 py-1 text-left">Plan</th>
                            <th className="px-2 py-1 text-right">Amount</th>
                            <th className="px-2 py-1 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUserStats.payments.slice(0, 10).map((p: any) => {
                            const dateSource = p.paid_at || p.created_at
                            const method =
                              p.payment_method === 'btcpay'
                                ? 'BTC Pay'
                                : p.payment_method === 'stripe'
                                ? 'Stripe'
                                : p.payment_method === 'paypal'
                                ? 'PayPal'
                                : p.payment_method || 'Unknown'

                            const amount =
                              typeof p.amount === 'number'
                                ? p.amount
                                : parseFloat(p.amount || '0')

                            return (
                              <tr key={`${p.payment_method || 'pm'}-${p.invoice_id}`} className="border-t">
                                <td className="px-2 py-1">
                                  {dateSource
                                    ? formatDateWithSettings(dateSource)
                                    : 'N/A'}
                                </td>
                                <td className="px-2 py-1">{method}</td>
                                <td className="px-2 py-1">{p.plan_type || 'N/A'}</td>
                                <td className="px-2 py-1 text-right">
                                  {p.currency || ''}{' '}
                                  {isNaN(amount) ? '-' : amount.toFixed(2)}
                                </td>
                                <td className="px-2 py-1">
                                  <span className="uppercase tracking-wide">
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      No payments yet for this user.
                    </div>
                  )}
                </div>

                {/* Coupon usage */}
                <div className="bg-gray-50 p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Coupon Usage</div>
                      <p className="text-xs text-gray-500">
                        Shows which coupons this user has redeemed.
                      </p>
                    </div>
                    {selectedUserStats.couponSummary && (
                      <div className="text-right text-sm text-gray-700">
                        <div>
                          Total used:{' '}
                          <span className="font-semibold">
                            {selectedUserStats.couponSummary.total_used || 0}
                          </span>
                        </div>
                        {selectedUserStats.couponSummary.last_code && (
                          <div>
                            Last:{' '}
                            <span className="font-mono">
                              {selectedUserStats.couponSummary.last_code}
                            </span>
                          </div>
                        )}
                        {selectedUserStats.couponSummary.last_used_at && (
                          <div>
                            Used at:{' '}
                            {formatDateWithSettings(
                              selectedUserStats.couponSummary.last_used_at
                            )}
                          </div>
                        )}
                        {selectedUserStats.couponSummary.referral_allocation && (
                          <div className="text-xs text-gray-500 mt-1">
                            Referral allocation:{' '}
                            {selectedUserStats.couponSummary.referral_allocation
                              .claimed_coupons || 0}{' '}
                            claimed /{' '}
                            {selectedUserStats.couponSummary.referral_allocation
                              .allocated_coupons || 0}{' '}
                            allocated
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedUserStats.couponUsages &&
                  selectedUserStats.couponUsages.length > 0 ? (
                    <div className="max-h-40 overflow-auto border border-gray-200 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Code</th>
                            <th className="px-2 py-1 text-left">Discount</th>
                            <th className="px-2 py-1 text-left">Used At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUserStats.couponUsages
                            .slice(0, 20)
                            .map((c: any) => (
                              <tr key={c.id} className="border-t">
                                <td className="px-2 py-1 font-mono">{c.code}</td>
                                <td className="px-2 py-1">
                                  {c.discount_percent}%{/* discount is per usage */}
                                </td>
                                <td className="px-2 py-1">
                                  {c.used_at
                                    ? formatDateWithSettings(c.used_at)
                                    : 'N/A'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      No coupons used by this user.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setSelectedUserStats(null)}
                className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Expiry Date Dialog */}
      {editingUserExpiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Set Premium Expiration</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                {editingUserExpiry.currentExpiry ? 'Current Expiry:' : 'Grant Premium Until:'}
              </label>
              {editingUserExpiry.currentExpiry && (
                <p className="text-sm text-gray-600 mb-2">
                  {new Date(editingUserExpiry.currentExpiry).toLocaleDateString()}
                </p>
              )}
              <input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditingUserExpiry(null)
                  setNewExpiryDate('')
                }}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => setUserExpiry(editingUserExpiry.userId, newExpiryDate)}
                disabled={!newExpiryDate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-30"
              >
                Set Expiry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

