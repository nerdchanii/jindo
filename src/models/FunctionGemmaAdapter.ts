/**
 * FunctionGemma Adapter
 * Implements IModelProvider for function calling with Ollama's functiongemma model
 */

import { IModelProvider, type ChatCompletion, type ChatCompletionOptions, type ChatMessage, type ModelInfo, type ToolCallRequest, type ToolCallResponse, ChatMessage } from './types/provider.js';

/**
 * Ollama function calling response types
 */
interface OllamaFunctionResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Configuration for FunctionGemmaAdapter
 */
export interface FunctionGemmaAdapterOptions {
  /** Ollama server URL */
  baseUrl?: string;
  /** Model identifier (default: 'functiongemma:270m') */
  model?: string;
  /** Timeout for requests in milliseconds */
  timeout?: number;
}

/**
 * FunctionGemma adapter for tool/function calling
 * Uses Ollama's function calling API (requires Ollama 0.1.30+)
 */
export class FunctionGemmaAdapter implements IModelProvider {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private modelInfo: ModelInfo;

  constructor(options: FunctionGemmaAdapterOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'functiongemma:270m';
    this.timeout = options.timeout || 300000; // 5 minutes default

    this.modelInfo = {
      id: `ollama:${this.model}`,
      name: 'functiongemma',
      provider: 'ollama',
      contextLength: 4096, // functiongemma has 4K context
      supportsFunctionCalling: true,
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
   * Convert our tool definition to Ollama's format
   */
  private convertTools(tools: ToolCallRequest['tools']): object[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Generate a chat completion (basic - not recommended for functiongemma)
   */
  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    const response = await fetch(this.getUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        options: {
          num_predict: options.maxTokens,
          temperature: options.temperature,
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data: OllamaFunctionResponse = await response.json();

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
   * Note: FunctionGemma doesn't support streaming well for tool calls
   */
  async *completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<{ content: string; done: boolean }, void, unknown> {
    const response = await fetch(this.getUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        options: {
          num_predict: options.maxTokens,
          temperature: options.temperature,
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
          const data = JSON.parse(line);
          yield {
            content: data.response || '',
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
   * Generate tool calls using Ollama's function calling API
   */
  async generateToolCalls(request: ToolCallRequest): Promise<ToolCallResponse> {
    const { tools, messages, forceTool } = request;

    const response = await fetch(this.getUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools: this.convertTools(tools),
        options: {
          temperature: forceTool ? 0.0 : 0.7,
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data: OllamaFunctionResponse = await response.json();

    // Extract tool calls from response
    const toolCalls = (data.message.tool_calls || []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

    return {
      toolCalls,
      reasoning: data.message.content,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }
}
