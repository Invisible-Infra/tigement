import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

interface Plan {
  id: string
  name: string
  duration: string
  price: number
  currency: string
  features: string[]
}

interface PremiumPageProps {
  onClose: () => void
}

export function PremiumPage({ onClose }: PremiumPageProps) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponValidating, setCouponValidating] = useState(false)
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null)
  const [couponError, setCouponError] = useState('')

  // Payment method state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true)

  useEffect(() => {
    loadPlans()
    loadPaymentMethods()
  }, [])

  const loadPlans = async () => {
    try {
      const data = await api.getPaymentPlans()
      
      // Convert backend response to Plan format
      const formattedPlans: Plan[] = [
        {
          id: 'monthly',
          name: 'Monthly Premium',
          duration: '1 month',
          price: data.monthly,
          currency: data.currency,
          features: [
            '✨ Sync across all devices',
            '🔐 End-to-end encryption',
            '📅 iCal export',
            '🚫 No ads',
            '⚡ Priority support'
          ]
        },
        {
          id: 'half-yearly',
          name: '6-Month Premium',
          duration: '6 months',
          price: data.halfYearly,
          currency: data.currency,
          features: [
            '✨ Sync across all devices',
            '🔐 End-to-end encryption',
            '📅 iCal export',
            '🚫 No ads',
            '⚡ Priority support',
            '💰 Save 15%'
          ]
        },
        {
          id: 'yearly',
          name: 'Yearly Premium',
          duration: '12 months',
          price: data.yearly,
          currency: data.currency,
          features: [
            '✨ Sync across all devices',
            '🔐 End-to-end encryption',
            '📅 iCal export',
            '🚫 No ads',
            '⚡ Priority support',
            '💰 Save 20%'
          ]
        }
      ]
      
      setPlans(formattedPlans)
    } catch (err: any) {
      setError('Failed to load pricing plans')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentMethods = async () => {
    try {
      const methods = await api.getPaymentMethods()
      const enabledMethods = methods.filter((m: any) => m.enabled)
      setPaymentMethods(enabledMethods)
      
      // Auto-select first enabled method
      if (enabledMethods.length > 0) {
        setSelectedPaymentMethod(enabledMethods[0].method_name)
      }
    } catch (err) {
      console.error('Failed to load payment methods:', err)
      // Default to btcpay if no methods loaded
      setPaymentMethods([{ method_name: 'btcpay', enabled: true, display_order: 1, discount_percent: 0, discount_amount: 0 }])
      setSelectedPaymentMethod('btcpay')
    } finally {
      setPaymentMethodsLoading(false)
    }
  }

  const getPaymentMethodDiscount = (): { percent: number; amount: number } => {
    if (!selectedPaymentMethod) return { percent: 0, amount: 0 }
    
    const method = paymentMethods.find(m => m.method_name === selectedPaymentMethod)
    if (!method) return { percent: 0, amount: 0 }
    
    return {
      percent: method.discount_percent || 0,
      amount: method.discount_amount || 0
    }
  }

  const calculateFinalPrice = (basePrice: number): { final: number; savings: number; details: string[] } => {
    let price = basePrice
    const details: string[] = []
    
    // Apply coupon discount (percentage)
    if (couponDiscount) {
      const couponSavings = price * (couponDiscount / 100)
      price -= couponSavings
      details.push(`Coupon: -${couponDiscount}% ($${couponSavings.toFixed(2)})`)
    }
    
    // Apply payment method discount (percentage or fixed amount)
    const methodDiscount = getPaymentMethodDiscount()
    if (methodDiscount.percent > 0) {
      const methodSavings = price * (methodDiscount.percent / 100)
      price -= methodSavings
      details.push(`Payment Method: -${methodDiscount.percent}% ($${methodSavings.toFixed(2)})`)
    } else if (methodDiscount.amount > 0) {
      price -= methodDiscount.amount
      details.push(`Payment Method: -$${methodDiscount.amount.toFixed(2)}`)
    }
    
    const savings = basePrice - price
    return { final: Math.max(0, price), savings, details }
  }

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code')
      return
    }

    setCouponValidating(true)
    setCouponError('')

    try {
      const result = await api.validateCoupon(couponCode.trim())
      
      if (result.valid && result.discount_percent) {
        setCouponDiscount(result.discount_percent)
        setCouponError('')
      } else {
        setCouponDiscount(null)
        setCouponError(result.error || 'Invalid coupon code')
      }
    } catch (err: any) {
      setCouponDiscount(null)
      setCouponError(err.message || 'Failed to validate coupon')
    } finally {
      setCouponValidating(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      setError('Please login first')
      return
    }

    setProcessingPlan(planId)
    setError('')

    try {
      // Check if this is a 100% discount (free)
      if (couponDiscount === 100) {
        // Activate premium for free
        const result = await api.activateFreePremium(planId, couponCode.trim())
        
        if (result.success) {
          alert('✅ ' + result.message + ' Refreshing page...')
          window.location.reload()
        } else {
          setError('Failed to activate premium')
        }
      } else {
        // Normal payment flow - use multi-gateway endpoint
        const invoice = await api.createPaymentInvoiceMulti(
          planId,
          selectedPaymentMethod,
          couponDiscount ? couponCode.trim() : undefined
        )
        
        // Open payment checkout in new tab
        window.open(invoice.checkoutUrl, '_blank')
        
        // Show success message based on payment method
        const methodName = paymentMethods.find(m => m.method_name === selectedPaymentMethod)?.method_name || 'payment'
        alert(`Payment window opened! Complete the ${methodName} payment to activate Premium. This page will automatically refresh when payment is confirmed.`)
        
        // Poll for payment completion
        pollPaymentStatus(invoice.invoiceId || invoice.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process subscription')
      console.error(err)
    } finally {
      setProcessingPlan(null)
    }
  }

  const pollPaymentStatus = async (invoiceId: string) => {
    // Poll every 5 seconds for up to 15 minutes
    const maxAttempts = 180
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      
      if (attempts > maxAttempts) {
        clearInterval(interval)
        return
      }

      try {
        const status = await api.getPaymentInvoiceStatus(invoiceId)
        
        if (status.status === 'paid' || status.status === 'confirmed') {
          clearInterval(interval)
          alert('✅ Payment successful! Premium activated!')
          window.location.reload()
        } else if (status.status === 'expired' || status.status === 'invalid') {
          clearInterval(interval)
          setError('Payment expired or failed. Please try again.')
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 5000)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-lg p-8`}>
          <div className="text-center">Loading plans...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className={`rounded-lg shadow-2xl max-w-6xl w-full my-8`} style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff' }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a6c7a] to-[#5a7c8a] text-white px-6 py-6 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">
                {user?.plan === 'premium' && user?.subscription_status === 'expired' ? '🔄 Renew Premium' : '✨ Upgrade to Premium'}
              </h2>
              <p className="text-sm mt-2 opacity-90">
                {user?.plan === 'premium' && user?.subscription_status === 'expired' 
                  ? 'Your premium subscription has expired. Choose a plan to renew.'
                  : 'Unlock sync, encryption, and more powerful features'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded px-3 py-1 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Expired Premium Banner */}
        {user?.plan === 'premium' && user?.subscription_status === 'expired' && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Premium Subscription Expired
                </h3>
                <div className="mt-1 text-sm text-red-700">
                  Your premium features are no longer available. Renew now to restore sync, encryption, and other premium features.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trial Banner */}
        {user?.plan === 'free' && !user?.subscription_expires && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-6 mt-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-2xl">🎉</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  10-Day Free Trial Included!
                </h3>
                <div className="mt-1 text-sm text-yellow-700">
                  New users get 10 days of Premium access when they subscribe.
                  Cancel anytime during the trial period.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Coupon Code Section */}
        <div className="px-6 pt-6">
          <div className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'} border-2 rounded-lg p-4`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <span className="text-3xl">🎟️</span>
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-1`}>Have a coupon code?</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value)
                      setCouponDiscount(null)
                      setCouponError('')
                    }}
                    placeholder="Enter coupon code"
                    className={`flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] ${
                      isDark 
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    disabled={couponValidating}
                  />
                  <button
                    onClick={validateCoupon}
                    disabled={couponValidating || !couponCode.trim()}
                    className="px-6 py-2 bg-[#4fc3f7] text-white font-medium rounded hover:bg-[#3ba3d7] disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed transition"
                  >
                    {couponValidating ? 'Validating...' : 'Apply'}
                  </button>
                </div>
                {couponDiscount && (
                  <p className="text-sm text-green-600 font-medium mt-2">
                    ✅ Coupon applied! You'll get {couponDiscount}% off your purchase.
                  </p>
                )}
                {couponError && (
                  <p className="text-sm text-red-600 mt-2">
                    ❌ {couponError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        {!paymentMethodsLoading && paymentMethods.length > 1 && (
          <div className="px-6 pt-4">
            <div className={`${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'} border-2 rounded-lg p-4`}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <span className="text-3xl">💳</span>
                </div>
                <div className="flex-1">
                  <h4 className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>Select Payment Method</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {paymentMethods.map((method) => {
                      const hasDiscount = (method.discount_percent > 0) || (method.discount_amount > 0)
                      const isSelected = selectedPaymentMethod === method.method_name
                      
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedPaymentMethod(method.method_name)}
                          className={`relative p-3 rounded-lg border-2 text-left transition ${
                            isSelected
                              ? 'border-purple-500 bg-purple-100'
                              : isDark 
                                ? 'border-gray-600 bg-gray-700 hover:border-purple-400'
                                : 'border-gray-300 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span 
                              className={`font-semibold ${isSelected ? '!text-gray-900' : (isDark ? 'text-gray-100' : 'text-gray-800')}`}
                            >
                              {method.method_name === 'btcpay' && 'Bitcoin/Crypto'}
                              {method.method_name === 'stripe' && 'Credit/Debit Card'}
                              {method.method_name === 'paypal' && 'PayPal'}
                            </span>
                            {isSelected && <span className="text-purple-600">✓</span>}
                          </div>
                          {hasDiscount && (
                            <div className="text-xs text-green-600 font-medium">
                              {method.discount_percent > 0 && `${method.discount_percent}% off`}
                              {method.discount_amount > 0 && `$${method.discount_amount} off`}
                            </div>
                          )}
                          {method.method_name === 'btcpay' && (
                            <div 
                              className={`text-xs mt-1 ${isSelected ? '!text-gray-700' : (isDark ? 'text-gray-400' : 'text-gray-500')}`}
                            >
                              Lightning, On-chain, Altcoins
                            </div>
                          )}
                          {method.method_name === 'stripe' && (
                            <div 
                              className={`text-xs mt-1 ${isSelected ? '!text-gray-700' : (isDark ? 'text-gray-400' : 'text-gray-500')}`}
                            >
                              Visa, Mastercard, Amex
                            </div>
                          )}
                          {method.method_name === 'paypal' && (
                            <div 
                              className={`text-xs mt-1 ${isSelected ? '!text-gray-700' : (isDark ? 'text-gray-400' : 'text-gray-500')}`}
                            >
                              PayPal Balance & Cards
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`border-2 rounded-lg p-6 transition hover:shadow-lg ${
                  plan.id === 'yearly'
                    ? `border-[#4fc3f7] ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`
                    : isDark 
                      ? 'border-gray-600 bg-gray-700'
                      : 'border-gray-300 bg-white'
                }`}
              >
                {plan.id === 'yearly' && (
                  <div className="bg-[#4fc3f7] text-white text-xs font-bold uppercase px-3 py-1 rounded-full inline-block mb-3">
                    Best Value
                  </div>
                )}
                
                <h3 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                  {plan.name}
                </h3>
                
                <div className="mb-4">
                  {(() => {
                    const priceCalc = calculateFinalPrice(plan.price)
                    const hasDiscounts = priceCalc.savings > 0
                    
                    return hasDiscounts ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-400 line-through">
                            {plan.currency === 'USD' ? '$' : plan.currency}
                            {plan.price.toFixed(2)}
                          </span>
                          <span className="text-4xl font-bold text-green-600">
                            {plan.currency === 'USD' ? '$' : plan.currency}
                            {priceCalc.final.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 font-medium space-y-1">
                          <div>💰 Total Savings: ${priceCalc.savings.toFixed(2)}</div>
                          {priceCalc.details.map((detail, idx) => (
                            <div key={idx} className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>• {detail}</div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className={`text-4xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                          {plan.currency === 'USD' ? '$' : plan.currency}
                          {plan.price.toFixed(2)}
                        </span>
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'} ml-2`}>/ {plan.duration}</span>
                      </>
                    )
                  })()}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} flex items-start`}>
                      <span className="mr-2">{feature.split(' ')[0]}</span>
                      <span>{feature.substring(feature.indexOf(' ') + 1)}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processingPlan === plan.id}
                  className={`w-full py-3 px-4 rounded font-medium transition ${
                    plan.id === 'yearly'
                      ? 'bg-[#4fc3f7] text-white hover:bg-[#3ba3d7]'
                      : 'bg-[#4a6c7a] text-white hover:bg-[#3a5c6a]'
                  }`}
                >
                  {processingPlan === plan.id
                    ? 'Processing...'
                    : user?.plan === 'premium' && user?.subscription_status === 'expired'
                    ? 'Renew Now'
                    : user?.plan === 'premium' && user?.subscription_status === 'active'
                    ? 'Extend Subscription'
                    : 'Subscribe Now'}
                </button>
              </div>
            ))}
          </div>

          {/* Payment Info */}
          <div className={`mt-8 p-6 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
            <h3 className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'} mb-3`}>💳 Payment Information</h3>
            <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} space-y-2`}>
              <p>• Multiple payment methods available (Crypto, Card, PayPal)</p>
              <p>• Secure payment processing with industry-standard encryption</p>
              <p>• Special discounts available for select payment methods</p>
              <p>• Cancel anytime, no questions asked</p>
              <p>• Instant activation after payment confirmation</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

