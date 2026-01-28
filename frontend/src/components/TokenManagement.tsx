import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

interface APIToken {
  id: number;
  name: string;
  scopes: string[];
  canDecrypt: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface TokenManagementProps {
  onClose: () => void;
}

export function TokenManagement({ onClose }: TokenManagementProps) {
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const generateRequestRef = useRef<boolean>(false);

  const [formData, setFormData] = useState({
    name: '',
    canDecrypt: true,
    expiresInDays: 90,
    scopes: ['workspace:read', 'workspace:write']
  });

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const response = await api.listApiTokens();
      setTokens(response.tokens);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (generating || generateRequestRef.current) return; // Prevent double-submission
    
    generateRequestRef.current = true;
    setGenerating(true);
    try {
      const response = await api.generateApiToken(formData);
      setGeneratedToken(response.token);
      setFormData({ name: '', canDecrypt: true, expiresInDays: 90, scopes: ['workspace:read', 'workspace:write'] });
      await loadTokens();
    } catch (error: any) {
      alert(`Failed to generate token: ${error.message}`);
    } finally {
      setGenerating(false);
      // Reset ref after a delay to allow next generation
      setTimeout(() => {
        generateRequestRef.current = false;
      }, 1000);
    }
  };

  const handleRevoke = async (id: number, name: string) => {
    if (!confirm(`Revoke token "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.revokeApiToken(id);
      await loadTokens();
    } catch (error: any) {
      alert(`Failed to revoke token: ${error.message}`);
    }
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      alert('Token copied to clipboard!');
    }
  };

  const toggleScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          Loading tokens...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            API Token Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Generate tokens for programmatic access to your workspace
          </p>
        </div>

        {generatedToken && (
          <div className="p-6 bg-green-50 dark:bg-green-900/20 border-b dark:border-green-800">
            <div className="font-medium text-green-900 dark:text-green-400 mb-2">
              ✓ Token Generated Successfully!
            </div>
            <div className="text-sm text-green-800 dark:text-green-300 mb-3">
              Copy this token now - it cannot be retrieved again.
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={generatedToken}
                readOnly
                className="flex-1 px-3 py-2 border border-green-300 dark:border-green-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
              />
              <button
                onClick={handleCopyToken}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copy
              </button>
              <button
                onClick={() => setGeneratedToken(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          {!showGenerate ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Your API Tokens ({tokens.length})
                </h3>
                <button
                  onClick={() => setShowGenerate(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Generate New Token
                </button>
              </div>

              {tokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔑</div>
                  <div>No API tokens yet</div>
                  <div className="text-sm mt-1">Generate your first token to get started</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {tokens.map(token => (
                    <div
                      key={token.id}
                      className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white mb-1">
                            {token.name}
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {token.scopes.map(scope => (
                              <span
                                key={scope}
                                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded"
                              >
                                {scope}
                              </span>
                            ))}
                            {token.canDecrypt && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 text-xs rounded">
                                Can decrypt
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            <div>Created: {new Date(token.createdAt).toLocaleString()}</div>
                            {token.lastUsedAt && (
                              <div>Last used: {new Date(token.lastUsedAt).toLocaleString()}</div>
                            )}
                            {token.expiresAt && (
                              <div className={
                                new Date(token.expiresAt) < new Date()
                                  ? 'text-red-600 dark:text-red-400'
                                  : ''
                              }>
                                Expires: {new Date(token.expiresAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(token.id, token.name)}
                          className="ml-4 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generate New Token
                </h3>
                <button
                  onClick={() => setShowGenerate(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CLI Tool, Mobile App"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scopes
                </label>
                <div className="space-y-2">
                  {['workspace:read', 'workspace:write'].map(scope => (
                    <label key={scope} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.scopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-gray-900 dark:text-white">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.canDecrypt}
                    onChange={(e) => setFormData({ ...formData, canDecrypt: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <div>
                    <div className="text-gray-900 dark:text-white font-medium">
                      Enable Decryption
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Allow this token to decrypt workspace data
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expires In (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 90 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave as 0 for no expiration
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!formData.name || formData.scopes.length === 0 || generating}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Token'}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
