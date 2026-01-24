/**
 * Internal Tool Types
 * Base types for agent-accessible tools
 */

import type { ToolDefinition } from '../../models/types/provider.js';

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Config directory path */
  configPath: string;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Whether the tool execution was successful */
  success: boolean;
  /** Result message for the user */
  message: string;
  /** Optional structured data */
  data?: unknown;
}

/**
 * Internal tool interface
 * All agent-accessible tools must implement this
 */
export interface InternalTool {
  /** Get tool definition for function calling */
  getDefinition(): ToolDefinition;
  /** Execute the tool with given arguments */
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
