/**
 * AI Response Validation and Error Handling
 */

import { AIResult, AIChange } from './aiAssistant';
import { AIConfig } from './aiProviders';

export class AIValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIValidationError';
  }
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

/**
 * Validate AI result structure
 */
export function validateAIResult(result: any): result is AIResult {
  if (!result || typeof result !== 'object') {
    throw new AIValidationError(
      'AI response is not an object',
      'INVALID_RESPONSE'
    );
  }

  if (!Array.isArray(result.changes)) {
    throw new AIValidationError(
      'AI response missing changes array',
      'MISSING_CHANGES'
    );
  }

  if (!result.summary || typeof result.summary !== 'string') {
    throw new AIValidationError(
      'AI response missing summary',
      'MISSING_SUMMARY'
    );
  }

  if (!result.reasoning || typeof result.reasoning !== 'string') {
    throw new AIValidationError(
      'AI response missing reasoning',
      'MISSING_REASONING'
    );
  }

  return true;
}

/**
 * Validate individual change
 */
export function validateChange(change: AIChange): { valid: boolean; error?: string } {
  if (!change.action) {
    return { valid: false, error: 'Change missing action field' };
  }

  const requiredFields: Record<string, string[]> = {
    move_tasks: ['from_table_id', 'to_table_id', 'task_ids'],
    update_task: ['table_id', 'task_id', 'updates'],
    create_task: ['table_id', 'task'],
    delete_task: ['table_id', 'task_id'],
    create_table: ['table'],
    update_table: ['table_id', 'updates'],
    reorder_tasks: ['table_id', 'task_ids']
  };

  const required = requiredFields[change.action];
  if (!required) {
    return { valid: false, error: `Unknown action: ${change.action}` };
  }

  for (const field of required) {
    if (!(field in change)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize AI response to prevent injection attacks
 */
export function sanitizeAIResult(result: AIResult): AIResult {
  console.log('🧹 Sanitize: Starting sanitization', {
    changesCount: result.changes.length,
    changes: result.changes.map(c => ({
      action: c.action,
      ...(c.action === 'create_table' ? {
        hasTable: !!c.table,
        tableId: c.table?.id,
        tablePosition: c.table?.position
      } : {})
    }))
  });
  
  const sanitized = {
    changes: result.changes.map(c => {
      console.log('🧹 Sanitize: Sanitizing change', {
        action: c.action,
        ...(c.action === 'create_table' ? {
          table: c.table ? JSON.stringify(c.table, null, 2) : 'null/undefined'
        } : {})
      });
      return sanitizeChange(c);
    }),
    summary: sanitizeString(result.summary),
    reasoning: sanitizeString(result.reasoning)
  };
  
  console.log('✅ Sanitize: Sanitization completed', {
    changesCount: sanitized.changes.length
  });
  
  return sanitized;
}

function sanitizeChange(change: AIChange): AIChange {
  const sanitized: AIChange = {
    action: sanitizeString(change.action)
  };

  // Copy and sanitize all other fields
  for (const [key, value] of Object.entries(change)) {
    if (key === 'action') continue;
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value === null || value === undefined) {
      // Preserve null/undefined values
      sanitized[key] = value;
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function sanitizeString(str: string): string {
  // Remove potential script tags and other dangerous content
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

function sanitizeObject(obj: any): any {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'string' ? sanitizeString(item) :
      item === null || item === undefined ? item :
      typeof item === 'object' ? sanitizeObject(item) :
      item
    );
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Handle AI provider errors
 */
export function handleProviderError(error: any, config: AIConfig): never {
  if (error.message?.includes('401') || error.message?.includes('403')) {
    throw new AIProviderError(
      'Invalid API key. Please check your configuration.',
      config.provider,
      401
    );
  }

  if (error.message?.includes('429')) {
    throw new AIProviderError(
      'Rate limit exceeded. Please try again later.',
      config.provider,
      429
    );
  }

  if (error.message?.includes('timeout') || error.message?.includes('network')) {
    throw new AIProviderError(
      'Network error. Please check your connection.',
      config.provider
    );
  }

  throw new AIProviderError(
    error.message || 'Unknown AI provider error',
    config.provider
  );
}

/**
 * Retry logic for transient failures
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on auth errors or validation errors
      if (error instanceof AIValidationError || error.statusCode === 401 || error.statusCode === 403) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Validate config before use
 */
export function validateAIConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.enabled) {
    errors.push('AI assistant is not enabled');
  }

  if (!config.apiKey) {
    errors.push('API key is required');
  }

  if (!config.provider) {
    errors.push('Provider is required');
  }

  if (!['openai', 'anthropic', 'custom'].includes(config.provider)) {
    errors.push(`Invalid provider: ${config.provider}`);
  }

  if (config.provider === 'custom' && !config.customEndpoint) {
    errors.push('Custom endpoint is required for custom provider');
  }

  if (!config.model) {
    errors.push('Model is required');
  }

  if (!['preview', 'automatic'].includes(config.mode)) {
    errors.push(`Invalid mode: ${config.mode}`);
  }

  if (config.undoWindowMinutes && (config.undoWindowMinutes < 1 || config.undoWindowMinutes > 1440)) {
    errors.push('Undo window must be between 1 and 1440 minutes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
