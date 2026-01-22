/**
 * Jindo Configuration Types
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

export interface MCPServerConfig {
  /** Whether the server is enabled */
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
  /** MCP server configurations */
  servers: Record<string, MCPServerConfig>;
}

export interface JindoConfig {
  /** Agent configuration */
  agent: AgentConfig;
  /** MCP server settings */
  mcp: MCPSettings;
}

export interface ConfigManagerOptions {
  /** Custom config path (default: ~/.config/jindo) */
  configPath?: string;
}
