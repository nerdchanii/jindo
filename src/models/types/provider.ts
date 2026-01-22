/**
 * Model Provider Types
 */

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/**
 * Chat completion request options
 */
export interface ChatCompletionOptions {
  /** Messages to send to the model */
  messages: ChatMessage[];
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Stop sequences */
  stop?: string[];
  /** Whether to stream the response */
  stream?: boolean;
}

/**
 * Chat completion response
 */
export interface ChatCompletion {
  /** The generated message */
  message: ChatMessage;
  /** Total tokens used */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Streamed chat completion chunk
 */
export interface ChatCompletionChunk {
  /** The delta content (accumulated for final message) */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Tool/function definition for function calling
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool call request
 */
export interface ToolCallRequest {
  /** The tools available for calling */
  tools: ToolDefinition[];
  /** The conversation messages */
  messages: ChatMessage[];
  /** Whether to force tool use */
  forceTool?: boolean;
}

/**
 * Tool call response
 */
export interface ToolCallResponse {
  /** The tool calls made by the model */
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  /** Reasoning text from the model */
  reasoning?: string;
  /** Total tokens used */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier (e.g., 'ollama:llama3.2:3b') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider name */
  provider: string;
  /** Context length supported */
  contextLength: number;
  /** Whether this model supports function calling */
  supportsFunctionCalling: boolean;
}

/**
 * Model provider interface
 * All model adapters must implement this interface
 */
export interface IModelProvider {
  /**
   * Get information about this model
   */
  getModelInfo(): ModelInfo;

  /**
   * Check if the model is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate a chat completion
   */
  complete(options: ChatCompletionOptions): Promise<ChatCompletion>;

  /**
   * Generate a streaming chat completion
   */
  completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown>;

  /**
   * Generate tool calls (function calling)
   */
  generateToolCalls(options: ToolCallRequest): Promise<ToolCallResponse>;
}
