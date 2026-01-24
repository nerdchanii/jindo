/**
 * Jindo Configuration Types
 */

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Conversation model for natural language responses */
  conversationModel: string;
  /** Function model for tool calling */
  functionModel: string;
  /** Output format: 'text' | 'markdown' */
  outputFormat: 'text' | 'markdown';
  /** Maximum conversation history messages */
  maxHistoryMessages: number;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  /** Server name (key in servers object) */
  name?: string;
  /** Whether to enable server */
  enabled: boolean;
  /** Command to run the server */
  command: string;
  /** Arguments for the command */
  args: string[];
  /** Description of the server */
  description?: string;
  /** Server type: 'builtin' | 'custom' */
  type?: 'builtin' | 'custom';
  /** Environment variables for the server */
  env?: Record<string, string>;
}

export interface MCPSettings {
  servers: Record<string, MCPServerConfig>;
}

export interface JindoConfig {
  agent: AgentConfig;
  mcp: MCPSettings;
}

export interface ConfigManagerOptions {
  configPath?: string;
}
