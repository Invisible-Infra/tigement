/**
 * AI Provider Clients for BYOA (Bring Your Own AI)
 * Supports OpenAI, Anthropic, and custom OpenAI-compatible APIs
 */

export interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  mode: 'preview' | 'automatic';
  undoWindowMinutes: number;
  customEndpoint?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * OpenAI API Client
 */
export class OpenAIClient {
  constructor(private config: AIConfig) {}

  async complete(messages: AIMessage[]): Promise<AIResponse> {
    const endpoint = this.config.customEndpoint || 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }
}

/**
 * Anthropic (Claude) API Client
 */
export class AnthropicClient {
  constructor(private config: AIConfig) {}

  async complete(messages: AIMessage[]): Promise<AIResponse> {
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined
    };
  }
}

/**
 * Custom OpenAI-Compatible API Client
 * Supports: Ollama, LM Studio, LocalAI, etc.
 */
export class CustomAPIClient extends OpenAIClient {
  // Inherits OpenAI client, but uses custom endpoint
  constructor(config: AIConfig) {
    if (!config.customEndpoint) {
      throw new Error('Custom API requires customEndpoint to be set');
    }
    super(config);
  }
}

/**
 * Factory to create appropriate AI client based on provider
 */
export function createAIClient(config: AIConfig) {
  switch (config.provider) {
    case 'openai':
      return new OpenAIClient(config);
    case 'anthropic':
      return new AnthropicClient(config);
    case 'custom':
      return new CustomAPIClient(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Test connection to AI provider
 */
export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createAIClient(config);
    // For OpenAI, we must include "json" in messages when using json_object response_format
    // The word "json" must appear somewhere in the messages
    const testMessages: AIMessage[] = [
      { role: 'system', content: 'You are a helpful assistant. Always respond with valid JSON.' },
      { role: 'user', content: 'Respond with a JSON object containing {"status": "OK"}' }
    ];
    
    const response = await client.complete(testMessages);
    
    if (response.content) {
      // Try to parse as JSON to verify it's valid
      try {
        const parsed = JSON.parse(response.content);
        if (parsed.status === 'OK' || parsed.status === 'ok') {
          return { success: true };
        }
      } catch (e) {
        // If parsing fails but we got content, connection still works
        // (some providers might not return strict JSON for test)
        return { success: true };
      }
      return { success: true };
    } else {
      return { success: false, error: 'Empty response from AI' };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    };
  }
}
