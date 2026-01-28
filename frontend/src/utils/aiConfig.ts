/**
 * AI Configuration Management
 * Stores AI provider API keys encrypted with user's encryption key
 */

import { encryptWorkspace, decryptWorkspace } from './encryption';
import { encryptionKeyManager } from './encryptionKey';
import { AIConfig } from './aiProviders';

const AI_CONFIG_STORAGE_KEY = 'tigement_ai_config';
const AI_HISTORY_STORAGE_KEY = 'tigement_ai_history';

export interface AIActionHistory {
  id: string;
  timestamp: number;
  requestPrompt: string;
  requestType: string;
  changesJson: any;
  beforeSnapshot: any;
  applied: boolean;
  appliedAt?: number;
  undoneAt?: number;
}

export const aiConfigManager = {
  /**
   * Save AI configuration (encrypted with user's encryption key)
   */
  async saveConfig(config: AIConfig): Promise<void> {
    const encryptionKey = encryptionKeyManager.getKey();
    if (!encryptionKey) {
      throw new Error('Encryption key not available. Please log in first.');
    }

    try {
      const encrypted = await encryptWorkspace(config, encryptionKey);
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to save AI config:', error);
      throw new Error('Failed to save AI configuration');
    }
  },

  /**
   * Load AI configuration (decrypted)
   */
  async loadConfig(): Promise<AIConfig | null> {
    const encryptionKey = encryptionKeyManager.getKey();
    if (!encryptionKey) {
      return null;
    }

    try {
      const encrypted = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (!encrypted) {
        return null;
      }

      const config = await decryptWorkspace(encrypted, encryptionKey);
      return config as AIConfig;
    } catch (error) {
      console.error('Failed to load AI config:', error);
      return null;
    }
  },

  /**
   * Clear AI configuration
   */
  clearConfig(): void {
    localStorage.removeItem(AI_CONFIG_STORAGE_KEY);
    localStorage.removeItem(AI_HISTORY_STORAGE_KEY);
  },

  /**
   * Check if AI is configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.loadConfig();
    return config !== null && config.enabled && !!config.apiKey;
  },

  /**
   * Save AI action to history (encrypted)
   */
  async saveAction(action: AIActionHistory): Promise<void> {
    const encryptionKey = encryptionKeyManager.getKey();
    if (!encryptionKey) {
      return;
    }

    try {
      const history = await this.loadHistory();
      history.push(action);

      // Keep only last 50 actions
      const trimmedHistory = history.slice(-50);

      const encrypted = await encryptWorkspace(trimmedHistory, encryptionKey);
      localStorage.setItem(AI_HISTORY_STORAGE_KEY, encrypted);
    } catch (error) {
      console.error('Failed to save AI action:', error);
    }
  },

  /**
   * Load AI action history (decrypted)
   */
  async loadHistory(): Promise<AIActionHistory[]> {
    const encryptionKey = encryptionKeyManager.getKey();
    if (!encryptionKey) {
      return [];
    }

    try {
      const encrypted = localStorage.getItem(AI_HISTORY_STORAGE_KEY);
      if (!encrypted) {
        return [];
      }

      const history = await decryptWorkspace(encrypted, encryptionKey);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Failed to load AI history:', error);
      return [];
    }
  },

  /**
   * Clear AI history
   */
  clearHistory(): void {
    localStorage.removeItem(AI_HISTORY_STORAGE_KEY);
  },

  /**
   * Get action by ID
   */
  async getAction(actionId: string): Promise<AIActionHistory | null> {
    const history = await this.loadHistory();
    return history.find(a => a.id === actionId) || null;
  },

  /**
   * Update action status
   */
  async updateAction(actionId: string, updates: Partial<AIActionHistory>): Promise<void> {
    const history = await this.loadHistory();
    const index = history.findIndex(a => a.id === actionId);
    
    if (index === -1) {
      throw new Error('Action not found');
    }

    history[index] = { ...history[index], ...updates };

    const encryptionKey = encryptionKeyManager.getKey();
    if (!encryptionKey) {
      return;
    }

    const encrypted = await encryptWorkspace(history, encryptionKey);
    localStorage.setItem(AI_HISTORY_STORAGE_KEY, encrypted);
  }
};
