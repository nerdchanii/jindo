/**
 * Model Selector
 * Manages conversation and function models with automatic selection and fallback
 */

import { OllamaAdapter } from './OllamaAdapter.js';
import { FunctionGemmaAdapter } from './FunctionGemmaAdapter.js';
import { AnthropicAdapter } from './AnthropicAdapter.js';
import { OpenAIAdapter } from './OpenAIAdapter.js';
import { GroqAdapter } from './GroqAdapter.js';
import type {
  IModelProvider,
  ChatCompletion,
  ChatCompletionOptions,
  ChatCompletionChunk,
  ToolCallRequest,
  ToolCallResponse,
  ModelInfo,
} from './types/provider.js';

/**
 * Preset configurations for model selection
 */
export type ModelPreset = 'lightweight' | 'balanced' | 'highend';

/**
 * Configuration for ModelSelector
 */
export interface ModelSelectorOptions {
  /** Conversation model (e.g., 'llama3.2:3b') */
  conversationModel?: string;
  /** Function model (e.g., 'functiongemma:270m') */
  functionModel?: string;
  /** Ollama server URL */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Fallback model if primary is unavailable */
  fallback?: {
    conversationModel?: string;
    functionModel?: string;
  };
  /** Provider configurations */
  providers?: Record<string, any>;
}

/**
 * Preset configurations
 */
export const MODEL_PRESETS: Record<
  ModelPreset,
  { conversationModel: string; functionModel: string }
> = {
  lightweight: {
    conversationModel: 'ollama:phi-3-mini',
    functionModel: 'ollama:functiongemma:270m',
  },
  balanced: {
    conversationModel: 'ollama:llama3.2:3b',
    functionModel: 'ollama:functiongemma:270m',
  },
  highend: {
    conversationModel: 'ollama:llama3.1:8b',
    functionModel: 'ollama:functiongemma:270m',
  },
};

/**
 * Model selector with automatic fallback
 * Manages conversation and function models for the agent
 */
export class ModelSelector {
  private conversationAdapter: IModelProvider | null = null;
  private functionAdapter: IModelProvider | null = null;
  private fallbackConversationAdapter: IModelProvider | null = null;
  private fallbackFunctionAdapter: IModelProvider | null = null;
  private conversationModelName: string;
  private functionModelName: string;
  private baseUrl: string;
  private timeout: number;
  private fallbackConversationModel?: string;
  private fallbackFunctionModel?: string;
  private providers: Record<string, { apiKey?: string; baseUrl?: string }>;

  constructor(options: ModelSelectorOptions = {}) {
    const preset = MODEL_PRESETS.balanced;
    this.conversationModelName =
      options.conversationModel || preset.conversationModel.replace('ollama:', '');
    this.functionModelName = options.functionModel || preset.functionModel.replace('ollama:', '');
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.timeout = options.timeout || 300000;
    this.fallbackConversationModel = options.fallback?.conversationModel;
    this.fallbackFunctionModel = options.fallback?.functionModel;
    this.providers = options.providers || {};
  }

  /**
   * Initialize adapters by checking model availability
   */
  async initialize(): Promise<{
    conversationModel: string;
    functionModel: string;
    hasFallback: boolean;
  }> {
    // Try to create conversation adapter
    this.conversationAdapter = this.createConversationAdapter(this.conversationModelName);
    const conversationAvailable = await this.conversationAdapter.isAvailable();

    if (!conversationAvailable && this.fallbackConversationModel) {
      this.fallbackConversationAdapter = this.createConversationAdapter(
        this.fallbackConversationModel
      );
      const fallbackAvailable = await this.fallbackConversationAdapter.isAvailable();
      if (fallbackAvailable) {
        this.conversationAdapter = this.fallbackConversationAdapter;
      }
    }

    // Try to create function adapter
    this.functionAdapter = this.createFunctionAdapter(this.functionModelName);
    const functionAvailable = await this.functionAdapter.isAvailable();

    if (!functionAvailable && this.fallbackFunctionModel) {
      this.fallbackFunctionAdapter = this.createFunctionAdapter(this.fallbackFunctionModel);
      const fallbackAvailable = await this.fallbackFunctionAdapter.isAvailable();
      if (fallbackAvailable) {
        this.functionAdapter = this.fallbackFunctionAdapter;
      }
    }

    return {
      conversationModel: this.conversationAdapter?.getModelInfo().id || 'none',
      functionModel: this.functionAdapter?.getModelInfo().id || 'none',
      hasFallback: !!(this.fallbackConversationAdapter || this.fallbackFunctionAdapter),
    };
  }

  /**
   * Parse provider and model from model string
   * Format: "provider:model" (e.g., "anthropic:claude-3-sonnet-20240229")
   * If no provider prefix, defaults to 'ollama'
   */
  private parseProviderAndModel(modelString: string): { provider: string; model: string } {
    const parts = modelString.split(':');
    const knownProviders = ['anthropic', 'openai', 'groq', 'ollama'];

    if (parts.length >= 2 && knownProviders.includes(parts[0])) {
      return { provider: parts[0], model: parts.slice(1).join(':') };
    }
    return { provider: 'ollama', model: modelString };
  }

  /**
   * Create a conversation model adapter based on provider
   */
  private createConversationAdapter(modelName: string): IModelProvider {
    const { provider, model } = this.parseProviderAndModel(modelName);
    const providerConfig = this.providers[provider] || {};

    switch (provider) {
      case 'anthropic':
        if (!providerConfig.apiKey) {
          throw new Error('Anthropic API key not configured. Use: jindo provider --set anthropic:apiKey=YOUR_KEY');
        }
        return new AnthropicAdapter({ apiKey: providerConfig.apiKey, model });
      case 'openai':
        if (!providerConfig.apiKey) {
          throw new Error('OpenAI API key not configured. Use: jindo provider --set openai:apiKey=YOUR_KEY');
        }
        return new OpenAIAdapter({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl, model });
      case 'groq':
        if (!providerConfig.apiKey) {
          throw new Error('Groq API key not configured. Use: jindo provider --set groq:apiKey=YOUR_KEY');
        }
        return new GroqAdapter({ apiKey: providerConfig.apiKey, model });
      case 'ollama':
      default:
        return new OllamaAdapter({ baseUrl: this.baseUrl, model, timeout: this.timeout });
    }
  }

  /**
   * Create a function model adapter based on provider
   * For cloud providers (anthropic, openai, groq), use the same adapter as conversation
   * since they support native function calling
   */
  private createFunctionAdapter(modelName: string): IModelProvider {
    const { provider, model } = this.parseProviderAndModel(modelName);
    const providerConfig = this.providers[provider] || {};

    switch (provider) {
      case 'anthropic':
        if (!providerConfig.apiKey) {
          throw new Error('Anthropic API key not configured. Use: jindo provider --set anthropic:apiKey=YOUR_KEY');
        }
        return new AnthropicAdapter({ apiKey: providerConfig.apiKey, model });
      case 'openai':
        if (!providerConfig.apiKey) {
          throw new Error('OpenAI API key not configured. Use: jindo provider --set openai:apiKey=YOUR_KEY');
        }
        return new OpenAIAdapter({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl, model });
      case 'groq':
        if (!providerConfig.apiKey) {
          throw new Error('Groq API key not configured. Use: jindo provider --set groq:apiKey=YOUR_KEY');
        }
        return new GroqAdapter({ apiKey: providerConfig.apiKey, model });
      case 'ollama':
      default:
        return new FunctionGemmaAdapter({ baseUrl: this.baseUrl, model, timeout: this.timeout });
    }
  }

  /**
   * Get the current conversation model info
   */
  getConversationModelInfo(): ModelInfo | null {
    return this.conversationAdapter?.getModelInfo() || null;
  }

  /**
   * Get the current function model info
   */
  getFunctionModelInfo(): ModelInfo | null {
    return this.functionAdapter?.getModelInfo() || null;
  }

  /**
   * Check if conversation model is available
   */
  async isConversationModelAvailable(): Promise<boolean> {
    return this.conversationAdapter?.isAvailable() ?? false;
  }

  /**
   * Check if function model is available
   */
  async isFunctionModelAvailable(): Promise<boolean> {
    return this.functionAdapter?.isAvailable() ?? false;
  }

  /**
   * Generate a chat completion using the conversation model
   */
  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    if (!this.conversationAdapter) {
      throw new Error('Conversation model not initialized. Call initialize() first.');
    }
    return this.conversationAdapter.complete(options);
  }

  /**
   * Generate a streaming chat completion
   */
  async *completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    if (!this.conversationAdapter) {
      throw new Error('Conversation model not initialized. Call initialize() first.');
    }
    yield* this.conversationAdapter.completeStream(options);
  }

  /**
   * Generate tool calls using the function model
   */
  async generateToolCalls(request: ToolCallRequest): Promise<ToolCallResponse> {
    if (!this.functionAdapter) {
      throw new Error('Function model not initialized. Call initialize() first.');
    }
    return this.functionAdapter.generateToolCalls(request);
  }

  /**
   * Check if both models are available
   */
  async isReady(): Promise<boolean> {
    const conversationReady = await this.isConversationModelAvailable();
    const functionReady = await this.isFunctionModelAvailable();
    return conversationReady && functionReady;
  }

  /**
   * Get all available models from Ollama
   */
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Switch to a different preset
   */
  async usePreset(preset: ModelPreset): Promise<void> {
    const config = MODEL_PRESETS[preset];
    if (!config) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    this.conversationModelName = config.conversationModel.replace('ollama:', '');
    this.functionModelName = config.functionModel.replace('ollama:', '');

    // Reinitialize
    await this.initialize();
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    preset: ModelPreset;
    conversationModel: string;
    functionModel: string;
    providers: Record<string, { apiKey?: string; baseUrl?: string }>;
  } {
    // Determine current preset
    let preset: ModelPreset = 'balanced';
    const currentConv = `ollama:${this.conversationModelName}`;
    const currentFunc = `ollama:${this.functionModelName}`;

    for (const [name, config] of Object.entries(MODEL_PRESETS)) {
      if (config.conversationModel === currentConv && config.functionModel === currentFunc) {
        preset = name as ModelPreset;
        break;
      }
    }

    return {
      preset,
      conversationModel: `ollama:${this.conversationModelName}`,
      functionModel: `ollama:${this.functionModelName}`,
      providers: this.providers,
    };
  }
}
