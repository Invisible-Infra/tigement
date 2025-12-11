/**
 * Referral Coupons Panel
 * Manage and share referral coupons
 */

import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import {
  shareToFacebook,
  shareToTwitter,
  shareToThreads,
  shareToWhatsApp,
  shareToTelegram,
  shareViaEmail,
  copyCouponCode,
  shareNative
} from '../utils/socialShare';

interface ReferralCouponsPanelProps {
  onClose: () => void;
}

export function ReferralCouponsPanel({ onClose }: ReferralCouponsPanelProps) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [allocation, setAllocation] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [couponsData, statsData] = await Promise.all([
        api.getMyCoupons(),
        api.getCouponStatistics()
      ]);
      
      setCoupons(couponsData.coupons);
      setAllocation(couponsData.allocation);
      setStatistics(statsData);
    } catch (error: any) {
      console.error('Failed to load referral data:', error);
      setMessage('Failed to load referral coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCoupons = async () => {
    if (!allocation || allocation.available <= 0) {
      setMessage('No coupons available to claim');
      return;
    }

    setClaiming(true);
    setMessage('');

    try {
      const result = await api.claimReferralCoupons();
      setMessage(`✅ Successfully generated ${result.totalGenerated} coupon${result.totalGenerated > 1 ? 's' : ''}!`);
      await loadData(); // Reload data
    } catch (error: any) {
      setMessage(`❌ ${error.message || 'Failed to claim coupons'}`);
    } finally {
      setClaiming(false);
    }
  };

  const handleCopy = async (code: string) => {
    const success = await copyCouponCode(code);
    if (success) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleShare = async (coupon: any, platform: string) => {
    const options = {
      couponCode: coupon.code,
      monthsGranted: coupon.months_granted
    };

    switch (platform) {
      case 'native':
        await shareNative(options);
        break;
      case 'facebook':
        shareToFacebook(options);
        break;
      case 'twitter':
        shareToTwitter(options);
        break;
      case 'threads':
        shareToThreads(options);
        break;
      case 'whatsapp':
        shareToWhatsApp(options);
        break;
      case 'telegram':
        shareToTelegram(options);
        break;
      case 'email':
        shareViaEmail(options);
        break;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <div className="text-center py-8">Loading referral coupons...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-2xl font-bold">🎁 Referral Coupons</h2>
          <button 
            onClick={onClose} 
            className="text-2xl hover:text-gray-300 transition"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">💡 How it works</h3>
            <p className="text-sm text-blue-800">
              Share your referral coupons with friends! Each coupon gives them free Tigement Premium. 
              You can share them on social media, sell them, or give them away!
            </p>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-[#4a6c7a]">{statistics.totalGenerated}</div>
                <div className="text-sm text-gray-600">Total Generated</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">{statistics.totalUsed}</div>
                <div className="text-sm text-gray-600">Used</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">{statistics.activeCount}</div>
                <div className="text-sm text-gray-600">Available</div>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">{statistics.conversionRate}%</div>
                <div className="text-sm text-gray-600">Conversion Rate</div>
              </div>
            </div>
          )}

          {/* Claim Section */}
          {allocation && (
            <div className="bg-green-50 border border-green-200 rounded p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-green-900">Available to Claim</h3>
                  <p className="text-sm text-green-700">
                    {allocation.available} coupon{allocation.available !== 1 ? 's' : ''} ready to generate
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Total allocated: {allocation.allocated} | Already claimed: {allocation.claimed}
                  </p>
                </div>
                <button
                  onClick={handleClaimCoupons}
                  disabled={claiming || allocation.available <= 0}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  {claiming ? 'Generating...' : 'Claim Coupons'}
                </button>
              </div>
              {message && (
                <div className={`mt-3 text-sm ${message.startsWith('✅') ? 'text-green-700' : 'text-red-700'}`}>
                  {message}
                </div>
              )}
            </div>
          )}

          {/* Coupons List */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Your Coupons</h3>
            
            {coupons.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">No coupons generated yet</p>
                <p className="text-sm">Claim your coupons above to start sharing!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {coupons.map((coupon) => (
                  <div 
                    key={coupon.id} 
                    className={`border rounded p-4 ${coupon.is_active && coupon.current_uses < coupon.max_uses ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-lg font-mono font-bold text-[#4a6c7a]">{coupon.code}</code>
                          <button
                            onClick={() => handleCopy(coupon.code)}
                            className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition"
                            title="Copy code"
                          >
                            {copiedCode === coupon.code ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <span className="font-semibold">{coupon.months_granted}</span> month{coupon.months_granted > 1 ? 's' : ''} of Premium
                          {' • '}
                          {coupon.is_active && coupon.current_uses < coupon.max_uses ? (
                            <span className="text-green-600">✓ Active</span>
                          ) : (
                            <span className="text-gray-500">Used</span>
                          )}
                          {' • '}
                          Created {new Date(coupon.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Share Buttons */}
                    {coupon.is_active && coupon.current_uses < coupon.max_uses && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-sm text-gray-600 mr-2">Share:</span>
                        {navigator.share && (
                          <button
                            onClick={() => handleShare(coupon, 'native')}
                            className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                          >
                            📱 Share
                          </button>
                        )}
                        <button
                          onClick={() => handleShare(coupon, 'facebook')}
                          className="text-xs px-3 py-1 bg-[#1877f2] text-white rounded hover:bg-[#166fe5] transition"
                        >
                          Facebook
                        </button>
                        <button
                          onClick={() => handleShare(coupon, 'twitter')}
                          className="text-xs px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition"
                        >
                          X/Twitter
                        </button>
                        <button
                          onClick={() => handleShare(coupon, 'whatsapp')}
                          className="text-xs px-3 py-1 bg-[#25d366] text-white rounded hover:bg-[#20bd5a] transition"
                        >
                          WhatsApp
                        </button>
                        <button
                          onClick={() => handleShare(coupon, 'telegram')}
                          className="text-xs px-3 py-1 bg-[#0088cc] text-white rounded hover:bg-[#0077b5] transition"
                        >
                          Telegram
                        </button>
                        <button
                          onClick={() => handleShare(coupon, 'email')}
                          className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                        >
                          Email
                        </button>
                      </div>
                    )}

                    {/* Usage info */}
                    {coupon.current_uses > 0 && coupon.usage_details && coupon.usage_details.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Used by user #{coupon.usage_details[0].user_id} on {new Date(coupon.usage_details[0].used_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

