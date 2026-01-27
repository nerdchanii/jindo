/**
 * OpenAI Model Provider Adapter
 */

import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionOptions,
  ChatMessage,
  ModelInfo,
  IModelProvider,
  ToolCallRequest,
  ToolCallResponse,
  ToolDefinition,
} from './types/provider.js';

export class OpenAIAdapter implements IModelProvider {
  private apiKey: string;
  private baseURL?: string;
  private model: string;

  constructor(config: { apiKey: string; baseURL?: string; model: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model;
  }

  getModelInfo(): ModelInfo {
    return {
      id: `openai:${this.model}`,
      name: this.model,
      provider: 'openai',
      contextLength: this.getContextLength(this.model),
      supportsFunctionCalling: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });

      const response = await openai.models.list();
      return response.data.some((model) => model.id === this.model);
    } catch {
      return false;
    }
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    const messages = this.convertMessages(options.messages);

    const completion = await openai.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stop: options.stop,
      stream: false,
    });

    return {
      message: {
        role: 'assistant',
        content: completion.choices[0]?.message?.content || '',
      },
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  }

  async *completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    const messages = this.convertMessages(options.messages);

    const stream = await openai.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stop: options.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield {
          content,
          done: false,
        };
      }
    }

    // Final chunk to mark completion
    yield {
      content: '',
      done: true,
    };
  }

  async generateToolCalls(options: ToolCallRequest): Promise<ToolCallResponse> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    });

    const messages = this.convertMessages(options.messages);
    const tools = this.convertTools(options.tools);

    const completion = await openai.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    });

    const toolCalls = completion.choices[0]?.message?.tool_calls || [];

    return {
      toolCalls: toolCalls.map((call) => ({
        id: call.id || '',
        name: (call as any)?.function?.name || '',
        arguments: (call as any)?.function?.arguments || '{}',
      })),
      reasoning: completion.choices[0]?.message?.content || '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  }

  private convertMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private getContextLength(model: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-3.5-turbo': 4096,
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-32k': 32768,
    };

    return contextLengths[model] || 4096;
  }
}
