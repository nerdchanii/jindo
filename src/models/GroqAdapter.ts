/**
 * Groq Model Provider Adapter
 */

import Groq from 'groq-sdk';
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

export class GroqAdapter implements IModelProvider {
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  getModelInfo(): ModelInfo {
    return {
      id: `groq:${this.model}`,
      name: this.model,
      provider: 'groq',
      contextLength: this.getContextLength(this.model),
      supportsFunctionCalling: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.length < 10) {
      return false;
    }
    try {
      const groq = new Groq({ apiKey: this.apiKey });
      // Make a minimal request to verify API access
      await groq.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    const groq = new Groq({ apiKey: this.apiKey });

    const messages = this.convertMessages(options.messages);

    const completion = await groq.chat.completions.create({
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
    const groq = new Groq({ apiKey: this.apiKey });

    const messages = this.convertMessages(options.messages);

    const stream = await groq.chat.completions.create({
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
    const groq = new Groq({ apiKey: this.apiKey });

    const messages = this.convertMessages(options.messages);
    const tools = this.convertTools(options.tools);

    const completion = await groq.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: options.forceTool ? 'required' : 'auto',
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    });

    const toolCalls = completion.choices[0]?.message?.tool_calls || [];

    return {
      toolCalls: toolCalls.map((call: any) => ({
        id: call.id || '',
        name: call.function?.name || '',
        arguments: call.function?.arguments || '{}',
      })),
      reasoning: completion.choices[0]?.message?.content || '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  }

  private convertMessages(messages: ChatMessage[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private convertTools(tools: ToolDefinition[]): any[] {
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
      'llama-3.3-70b-versatile': 128000,
      'llama-3.1-70b-versatile': 128000,
      'llama-3.1-8b-instant': 128000,
      'mixtral-8x7b-32768': 32768,
      'gemma2-9b-it': 8192,
    };

    return contextLengths[model] || 8192;
  }
}
