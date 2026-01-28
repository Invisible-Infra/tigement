import { useState, useEffect } from 'react';
import { aiConfigManager } from '../utils/aiConfig';
import { AIConfig } from '../utils/aiProviders';
import { testAIConnection } from '../utils/aiProviders';
import { validateAIConfig } from '../utils/aiValidation';

interface AIConfigPanelProps {
  onClose: () => void;
}

export function AIConfigPanel({ onClose }: AIConfigPanelProps) {
  const [config, setConfig] = useState<AIConfig>({
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    mode: 'preview',
    undoWindowMinutes: 60
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loaded = await aiConfigManager.loadConfig();
      if (loaded) {
        setConfig(loaded);
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const validation = validateAIConfig(config);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await aiConfigManager.saveConfig(config);
      onClose();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save configuration']);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const validation = validateAIConfig(config);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setTesting(true);
    setErrors([]);
    try {
      const result = await testAIConnection(config);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear AI configuration? This will also clear all action history.')) {
      aiConfigManager.clearConfig();
      setConfig({
        enabled: false,
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o-mini',
        mode: 'preview',
        undoWindowMinutes: 60
      });
      setTestResult(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Assistant Configuration
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Bring Your Own AI - Connect your AI provider
          </p>
        </div>

        <div className="p-6 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="font-medium text-red-800 dark:text-red-400 mb-2">Errors:</div>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                {errors.map((error, i) => <li key={i}>{error}</li>)}
              </ul>
            </div>
          )}

          {testResult && (
            <div className={`border rounded-lg p-4 ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <div className={`font-medium ${
                testResult.success
                  ? 'text-green-800 dark:text-green-400'
                  : 'text-red-800 dark:text-red-400'
              }`}>
                {testResult.success ? '✓ Connection successful!' : '✗ Connection failed'}
              </div>
              {testResult.error && (
                <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {testResult.error}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-gray-900 dark:text-white font-medium">Enable AI Assistant</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              All processing happens in your browser. API keys are encrypted locally.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider
            </label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">Custom (Ollama, LM Studio, etc.)</option>
            </select>
          </div>

          {config.provider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Endpoint
              </label>
              <input
                type="url"
                value={config.customEndpoint || ''}
                onChange={(e) => setConfig({ ...config, customEndpoint: e.target.value })}
                placeholder="http://localhost:11434/v1/chat/completions"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Stored encrypted locally. Never sent to Tigement servers.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Examples: gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022, llama3
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={config.mode === 'preview'}
                  onChange={() => setConfig({ ...config, mode: 'preview' })}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-gray-900 dark:text-white">Preview (Recommended)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Review changes before applying
                  </div>
                </div>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  checked={config.mode === 'automatic'}
                  onChange={() => setConfig({ ...config, mode: 'automatic' })}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-gray-900 dark:text-white">Automatic</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Apply changes immediately (with undo)
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Undo Window (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="1440"
              value={config.undoWindowMinutes}
              onChange={(e) => setConfig({ ...config, undoWindowMinutes: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How long to keep undo history (1-1440 minutes)
            </p>
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !config.apiKey}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 ml-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
