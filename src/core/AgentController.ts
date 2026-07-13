/**
 * Agent Controller
 * Main orchestrator for Jindo agent
 */

import { ModelSelector } from '../models/ModelSelector.js';
import { Conversation } from './Conversation.js';
import { Memory, type MemoryEntry } from './Memory.js';
import { ToolExecutor } from './ToolExecutor.js';
import { FunctionRouter } from './FunctionRouter.js';
import { PromptManager } from '../prompts/PromptManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type {
  ChatCompletion,
  ChatCompletionOptions,
  ChatMessage,
  ToolDefinition,
  ToolCallRequest,
} from '../models/types/provider.js';

export interface AgentConfig {
  modelSelector: ModelSelector;
  maxHistoryMessages?: number;
  maxMemoryEntries?: number;
  systemPrompt?: string;
}

export interface AgentResponse {
  text: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  tokens: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  executionTime: number;
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Remove non-Korean characters from text
 * Filters out English letters and common foreign words while preserving Korean
 */
function filterToKoreanOnly(text: string): string {
  // Allow ONLY Korean characters, numbers, and basic punctuation
  let filtered = text;

  // Remove ALL non-Korean characters except basic punctuation and numbers
  filtered = filtered.replace(/[^가-힣\s\d\.\,\!\?\-\~]/g, '');

  // Remove any remaining single non-Korean characters
  filtered = filtered.replace(/[^가-힣\d\s\.\,\!\?\-\~]+/g, '');

  // Clean up multiple spaces and ensure proper spacing
  filtered = filtered
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/^\s+/, '') // Leading spaces
    .replace(/\s+$/, '') // Trailing spaces
    .trim();

  // If result is empty or too short after filtering, provide fallback
  if (filtered.length < 2) {
    filtered = '안녕하세요! 무엇을 도와드릴까요?';
  }

  return filtered;
}

export interface AgentControllerOptions {
  config: AgentConfig;
  configManager: ConfigManager;
  streaming?: boolean;
}

/**
 * Main agent controller
 * Orchestrates conversation, tools, and models
 */
export class AgentController {
  private modelSelector: ModelSelector;
  private conversation: Conversation;
  private memory: Memory;
  private toolExecutor: ToolExecutor;
  private functionRouter: FunctionRouter;
  private promptManager: PromptManager;
  public readonly config: AgentConfig;
  private streaming: boolean;
  private isInitialized: boolean = false;

  constructor(options: AgentControllerOptions) {
    this.config = options.config;
    this.streaming = options.streaming ?? false;
    this.modelSelector = options.config.modelSelector;
    this.promptManager = new PromptManager(options.configManager);
    this.conversation = new Conversation({
      maxMessages: options.config.maxHistoryMessages || 50,
    });
    this.memory = new Memory({
      maxEntries: options.config.maxMemoryEntries || 1000,
      enableExpiration: true,
    });
    this.toolExecutor = new ToolExecutor();
    this.functionRouter = new FunctionRouter();
  }

  /**
   * Initialize agent
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize model selector
    await this.modelSelector.initialize();

    // Set system prompt from PromptManager
    const systemPrompt = await this.promptManager.getSystemPrompt();
    this.conversation.setSystemPrompt(systemPrompt);

    this.isInitialized = true;
  }

  /**
   * Check if agent is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.isInitialized) return false;

    const modelsReady = await this.modelSelector.isReady();
    return modelsReady;
  }

  async processMessage(userMessage: string, callbacks?: StreamCallbacks): Promise<AgentResponse> {
    const startTime = Date.now();

    // Add user message to conversation
    this.conversation.addUserMessage(userMessage);

    // Get conversation history
    const messages = this.conversation.getMessages(true);

    // Get available tools
    const tools = this.toolExecutor.getAllTools();
    this.functionRouter.registerTools(tools);

    // Route: decide whether to use function model or conversation model
    const routeResult = await this.functionRouter.route({
      tools,
      messages,
      forceTool: false,
    });

    let responseText = '';
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    let totalTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    if (routeResult.toolCalls.length > 0) {
      // Use function model
      for (const toolCall of routeResult.toolCalls) {
        if (toolCall.name === 'model_call') {
          const functionRequest: ToolCallRequest = toolCall.args as any;
          const toolCallResponse = await this.modelSelector.generateToolCalls(functionRequest);

          for (const call of toolCallResponse.toolCalls) {
            toolCalls.push({
              name: call.name,
              args: JSON.parse(call.arguments),
            });
          }

          totalTokens.completionTokens += toolCallResponse.usage.completionTokens;
          totalTokens.promptTokens += toolCallResponse.usage.promptTokens;
          totalTokens.totalTokens += toolCallResponse.usage.totalTokens;

          // Execute tools
          const results = await this.toolExecutor.executeMany(
            toolCalls.map((tc) => ({ name: tc.name, args: tc.args as Record<string, unknown> }))
          );

          // Format tool results
          const toolResultsText = this.functionRouter.formatToolResults(results);

          // Add tool results to conversation
          if (toolResultsText) {
            this.conversation.addAssistantMessage(toolResultsText);
          }
        }
      }
    } else if (routeResult.useConversationModel) {
      // Use conversation model directly
      const completionOptions: ChatCompletionOptions = {
        messages,
        temperature: 0.7,
        maxTokens: 1000,
      };

      if (this.streaming) {
        let streamedText = '';
        try {
          for await (const chunk of this.modelSelector.completeStream(completionOptions)) {
            if (chunk.content) {
              callbacks?.onChunk?.(chunk.content);
              streamedText += chunk.content;
            }
          }
          responseText = streamedText || '[No response]';
          responseText = filterToKoreanOnly(responseText);
          callbacks?.onComplete?.(responseText);
          this.conversation.addAssistantMessage(responseText);
        } catch (error) {
          callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      } else {
        const completion: ChatCompletion = await this.modelSelector.complete(completionOptions);
        responseText = completion.message.content;
        responseText = filterToKoreanOnly(responseText);
        this.conversation.addAssistantMessage(responseText);

        totalTokens.completionTokens = completion.usage.completionTokens;
        totalTokens.promptTokens = completion.usage.promptTokens;
        totalTokens.totalTokens = completion.usage.totalTokens;
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      text: responseText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      tokens: totalTokens,
      executionTime,
    };
  }

  /**
   * Register a tool
   */
  registerTool(tool: {
    definition: ToolDefinition;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
  }): void {
    this.toolExecutor.register(tool);
    this.functionRouter.registerTool(tool.definition);
  }

  /**
   * Register multiple tools
   */
  registerMany(
    tools: Array<{
      definition: ToolDefinition;
      handler: (args: Record<string, unknown>) => Promise<unknown>;
    }>
  ): void {
    this.toolExecutor.registerMany(tools);
    for (const tool of tools) {
      this.functionRouter.registerTool(tool.definition);
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversation.clear();
  }

  /**
   * Reset agent (clear everything)
   */
  reset(): void {
    this.conversation.reset();
    this.memory.clear();
    this.toolExecutor.clearTools();
    this.functionRouter.clearTools();
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(): { id: string; messageCount: number; lastMessage?: ChatMessage } {
    return this.conversation.getSummary();
  }

  /**
   * Search memory
   */
  searchMemory(query: string, limit?: number): MemoryEntry[] {
    return this.memory.search({ query, limit });
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<{
    conversation: ReturnType<Conversation['getSummary']>;
    memory: ReturnType<Memory['getStats']>;
    tools: ReturnType<ToolExecutor['getToolCount']>;
    models: {
      conversationModel: string | null;
      functionModel: string | null;
      isReady: boolean;
    };
  }> {
    return {
      conversation: this.conversation.getSummary(),
      memory: this.memory.getStats(),
      tools: this.toolExecutor.getToolCount(),
      models: {
        conversationModel: this.modelSelector.getConversationModelInfo()?.id || null,
        functionModel: this.modelSelector.getFunctionModelInfo()?.id || null,
        isReady: await this.isReady(),
      },
    };
  }
}
