/**
 * Anthropic Model Provider Adapter
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicAdapter implements IModelProvider {
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  getModelInfo(): ModelInfo {
    return {
      id: `anthropic:${this.model}`,
      name: this.model,
      provider: 'anthropic',
      contextLength: this.getContextLength(this.model),
      supportsFunctionCalling: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const anthropic = new Anthropic({
        apiKey: this.apiKey,
      });

      // Check if we can access the API
      await anthropic.messages.create({
        model: this.model,
        max_tokens: 1, // Minimal request to test availability
        messages: [{ role: 'user', content: 'test' }],
      });

      return true;
    } catch {
      return false;
    }
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletion> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    const messages = this.convertMessages(options.messages);

    const completion = await anthropic.messages.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      stop_sequences: options.stop,
    });

    return {
      message: {
        role: 'assistant',
        content:
          completion.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('') || '',
      },
      usage: {
        promptTokens: completion.usage?.input_tokens || 0,
        completionTokens: completion.usage?.output_tokens || 0,
        totalTokens: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0),
      },
    };
  }

  async *completeStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    const messages = this.convertMessages(options.messages);

    const stream = await anthropic.messages.create({
      model: this.model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
      stop_sequences: options.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const delta = chunk.delta as any;
        if (delta?.text) {
          yield {
            content: delta.text,
            done: false,
          };
        }
      }
    }

    // Final chunk to mark completion
    yield {
      content: '',
      done: true,
    };
  }

  async generateToolCalls(options: ToolCallRequest): Promise<ToolCallResponse> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
    });

    const messages = this.convertMessages(options.messages);
    const tools = this.convertTools(options.tools);

    const completion = await anthropic.messages.create({
      model: this.model,
      messages,
      tools,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature,
    });

    const toolCalls = completion.content
      .filter((block: any) => block.type === 'tool_use')
      .map((use: any) => ({
        id: use.id || '',
        name: use.name || '',
        arguments: JSON.stringify(use.input || {}),
      }));

    const textContent = completion.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return {
      toolCalls,
      reasoning: textContent,
      usage: {
        promptTokens: completion.usage?.input_tokens || 0,
        completionTokens: completion.usage?.output_tokens || 0,
        totalTokens: completion.usage?.input_tokens + completion.usage?.output_tokens || 0,
      },
    };
  }

  private convertMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    let systemMessage = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content;
      } else {
        result.push({
          role: msg.role as 'user' | 'assistant',
          content:
            msg.role === 'user' && systemMessage
              ? [
                  { type: 'text', text: systemMessage },
                  { type: 'text', text: msg.content },
                ]
              : msg.content,
        });
        if (systemMessage && msg.role === 'user') {
          systemMessage = ''; // Clear system message after using it
        }
      }
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private getContextLength(model: string): number {
    const contextLengths: Record<string, number> = {
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-5-haiku-20241022': 200000,
      'claude-3-opus-20240229': 200000,
    };

    return contextLengths[model] || 200000;
  }
}
