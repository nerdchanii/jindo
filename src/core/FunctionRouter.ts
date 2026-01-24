/**
 * Function Router
 * Routes tool/function calls to appropriate handlers
 */

import type { ToolDefinition, ToolCallRequest } from '../models/types/provider.js';
import type { ToolExecutionResult } from './ToolExecutor.js';

/**
 * Routing options
 */
export interface FunctionRouterOptions {
  /** Enable automatic fallback to conversation model */
  enableFallback?: boolean;
  /** Maximum number of function calls per turn */
  maxCallsPerTurn?: number;
}

/**
 * Route result
 */
export interface RouteResult {
  /** Tool calls to execute */
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** Whether to use conversation model for final response */
  useConversationModel: boolean;
  /** Reasoning from function model */
  reasoning?: string;
}

/**
 * Function router for determining when to use tools vs conversation
 */
export class FunctionRouter {
  private toolDefinitions: Map<string, ToolDefinition> = new Map();
  private _maxCallsPerTurn: number;

  constructor(options: FunctionRouterOptions = {}) {
    this._maxCallsPerTurn = options.maxCallsPerTurn ?? 5;
  }

  get maxCallsPerTurn(): number {
    return this._maxCallsPerTurn;
  }

  /**
   * Register a tool definition
   */
  registerTool(tool: ToolDefinition): void {
    this.toolDefinitions.set(tool.name, tool);
  }

  /**
   * Register multiple tool definitions
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Determine routing based on user input
   */
  async route(request: ToolCallRequest): Promise<RouteResult> {
    const { tools, messages, forceTool } = request;

    if (forceTool) {
      // Force tool use - always route to function model
      return {
        toolCalls: [{ name: 'model_call', args: { tools, messages } }],
        useConversationModel: false,
      };
    }

    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (!lastUserMessage) {
      return {
        toolCalls: [],
        useConversationModel: true,
      };
    }

    const userContent = lastUserMessage.content.toLowerCase();
    const mentionsTool = tools.some((t) => userContent.includes(t.name.toLowerCase()));

    if (mentionsTool) {
      return {
        toolCalls: [{ name: 'model_call', args: { tools, messages } }],
        useConversationModel: false,
      };
    }

    // Check if user is asking for something that requires tools
    const toolKeywords = ['search', 'find', 'lookup', 'calculate', 'execute', 'run', 'call'];
    const needsTools = toolKeywords.some((kw) => userContent.includes(kw));

    if (needsTools && tools.length > 0) {
      return {
        toolCalls: [{ name: 'model_call', args: { tools, messages } }],
        useConversationModel: false,
      };
    }

    // Default to conversation model
    return {
      toolCalls: [],
      useConversationModel: true,
    };
  }

  /**
   * Process function model response and route to actual tools
   */
  processModelResponse(response: { toolCalls: Array<{ name: string; arguments: string }> }): {
    calls: Array<{ name: string; args: Record<string, unknown> }>;
  } {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];

    for (const toolCall of response.toolCalls) {
      try {
        const args = JSON.parse(toolCall.arguments);
        calls.push({
          name: toolCall.name,
          args,
        });
      } catch {
        // Invalid JSON, skip
        continue;
      }
    }

    return { calls };
  }

  /**
   * Merge tool execution results
   */
  formatToolResults(results: ToolExecutionResult[]): string {
    if (results.length === 0) {
      return 'No tools were executed.';
    }

    const parts: string[] = [];
    for (const result of results) {
      if (result.success) {
        parts.push(`${result.name}: ${JSON.stringify(result.result)}`);
      } else {
        parts.push(`${result.name}: Error - ${result.error}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.toolDefinitions.has(name);
  }

  /**
   * Get all tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Clear all tool definitions
   */
  clearTools(): void {
    this.toolDefinitions.clear();
  }
}
