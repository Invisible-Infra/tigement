/**
 * Encryption Passphrase Dialog
 * Prompts user to set or enter encryption passphrase after OAuth login
 */

import { useState } from 'react';
import { api } from '../../utils/api';

interface EncryptionPassphraseDialogProps {
  oauthToken: string;
  isNewUser: boolean;
  onSuccess: (authResponse: any, passphrase: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export function EncryptionPassphraseDialog({ 
  oauthToken, 
  isNewUser, 
  onSuccess, 
  onError,
  onClose 
}: EncryptionPassphraseDialogProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isNewUser && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.setOAuthPassphrase(oauthToken, passphrase, isNewUser);
      onSuccess(response, passphrase);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to process passphrase';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassphrase = async () => {
    setLoading(true);
    setError('');
    try {
      await api.resetOAuthPassphrase(oauthToken);
      setShowResetConfirm(false);
      // After reset, treat as new user to set new passphrase
      window.location.reload(); // Reload to get fresh state
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to reset passphrase';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[450px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#4a6c7a] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {isNewUser ? '🔐 Set Encryption Passphrase' : '🔐 Enter Encryption Passphrase'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-2xl hover:text-gray-300 transition"
            disabled={loading}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Information Banner */}
          <div className={`${isNewUser ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-blue-50 border-blue-200 text-blue-800'} border px-4 py-3 rounded text-sm`}>
            {isNewUser ? (
              <>
                <p className="font-semibold mb-2">⚠️ Important - Read Carefully</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>This passphrase encrypts your data with <strong>zero-knowledge encryption</strong></li>
                  <li>It's <strong>separate from your login</strong> credentials</li>
                  <li><strong>Cannot be recovered</strong> if lost - your data will be permanently inaccessible</li>
                  <li><strong>Write it down</strong> and store it safely!</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-semibold mb-1">🔒 Encryption Passphrase Required</p>
                <p>Enter your encryption passphrase to decrypt and access your data.</p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* Passphrase Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isNewUser ? 'Create Encryption Passphrase' : 'Encryption Passphrase'}
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
              placeholder="••••••••"
              autoFocus
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>

          {/* Confirm Passphrase (only for new users) */}
          {isNewUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Encryption Passphrase
              </label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          {/* Security Notice */}
          {isNewUser && (
            <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded text-xs text-gray-700">
              <p className="font-semibold mb-1">🛡️ Zero-Knowledge Security</p>
              <p>
                Your passphrase never leaves your device unencrypted. 
                The server only stores a verification hash and cannot access your data.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4fc3f7] text-white py-3 rounded font-medium hover:bg-[#3ba3d7] disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <span>Processing...</span>
            ) : isNewUser ? (
              <span>Set Passphrase & Continue</span>
            ) : (
              <span>Unlock & Continue</span>
            )}
          </button>

          {/* Cancel Option */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full text-gray-600 py-2 text-sm hover:text-gray-800 disabled:text-gray-400"
          >
            Cancel
          </button>

          {/* Forgot Passphrase Link (only for existing users) */}
          {!isNewUser && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-700 hover:underline disabled:text-gray-400"
              >
                Forgot passphrase? Reset it
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg shadow-2xl w-[400px] p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Reset Encryption Passphrase?</h3>
            
            <div className="space-y-3 text-sm text-gray-700 mb-6">
              <p className="font-semibold">This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>All encrypted workspace data</li>
                <li>All notebooks and notes</li>
                <li>All diary entries</li>
                <li>All archived tables</li>
              </ul>
              <p className="font-semibold text-red-600 mt-3">
                This action cannot be undone!
              </p>
              <p>
                After reset, you can set a new passphrase and start fresh.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassphrase}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset & Delete Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

