/**
 * Ollama Model Adapter
 * Implements IModelProvider for Ollama's REST API
 */

import {
  IModelProvider,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatCompletionOptions,
  type ChatMessage,
  type ModelInfo,
} from './types/provider.js';

/**
 * Ollama API response types
 */
interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message?: OllamaMessage;
  done: boolean;
}

/**
 * Configuration for OllamaAdapter
 */
export interface OllamaAdapterOptions {
  /** Ollama server URL */
  baseUrl?: string;
  /** Model identifier (e.g., 'llama3.2:3b') */
  model: string;
  /** Timeout for requests in milliseconds */
  timeout?: number;
}

/**
 * Ollama adapter for conversation models
 * Handles chat completions via Ollama's REST API
 */
export class OllamaAdapter implements IModelProvider {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private modelInfo: ModelInfo;

  constructor(options: OllamaAdapterOptions) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model;
    this.timeout = options.timeout || 300000; // 5 minutes default

    // Parse model name from Ollama format
    const modelName = this.model.includes(':') ? this.model.split(':')[0] : this.model;

    this.modelInfo = {
      id: `ollama:${this.model}`,
      name: modelName,
      provider: 'ollama',
      contextLength: 8192, // Default for most Ollama models
      supportsFunctionCalling: false, // Ollama's basic chat doesn't support function calling
    };
  }

  /**
   * Get Ollama API URL for a specific endpoint
   */
  private getUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * Get model information
   */
  getModelInfo(): ModelInfo {
    return this.modelInfo;
  }

  /**
   * Check if Ollama server is running and model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if server is running
      const response = await fetch(this.getUrl('/api/version'), {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return false;
      }

      // Check if model is available
      const modelResponse = await fetch(this.getUrl('/api/show'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.model }),
        signal: AbortSignal.timeout(this.timeout),
      });

      return modelResponse.ok;
    } catch {
      return false;
    }
  }

  /**
   * Convert our message format to Ollama's format
   */
  private convertMessages(messages: ChatMessage[]): OllamaMessage[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role,
      content: msg.content,
    }));
  }

  /**
   * Generate a chat completion
   */
  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    const { messages, maxTokens, temperature } = options;

    const response = await fetch(this.getUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(messages),
        options: {
          num_predict: maxTokens,
          temperature,
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as OllamaResponse;

    return {
      message: {
        role: data.message.role as 'user' | 'assistant' | 'system',
        content: data.message.content,
      },
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  /**
   * Generate a streaming chat completion
   */
  async *completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const { messages, maxTokens, temperature } = options;

    const response = await fetch(this.getUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(messages),
        options: {
          num_predict: maxTokens,
          temperature,
        },
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data: OllamaStreamResponse = JSON.parse(line);
          yield {
            content: data.message?.content || '',
            done: data.done,
          };

          if (data.done) return;
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  /**
   * Generate tool calls (not supported in basic Ollama chat)
   * For function calling, use FunctionGemmaAdapter instead
   */
  async generateToolCalls(): Promise<never> {
    throw new Error(
      'generateToolCalls is not supported in OllamaAdapter. ' +
        'Use FunctionGemmaAdapter for function calling.'
    );
  }
}
