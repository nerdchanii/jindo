/**
 * MCP Registry
 * Manages MCP server connections and tool registration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type { MCPServerConfig } from '../config/types/config.js';
import { substituteEnvVarsInObject } from './EnvSubstitution.js';

export interface MCPToolDefinition extends Tool {
  serverName: string;
}

export interface MCPConnection {
  server: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  tools: MCPToolDefinition[];
  connected: boolean;
}

/**
 * Registry for MCP servers and their tools
 */
export class MCPRegistry {
  private connections = new Map<string, MCPConnection>();
  private configManager: ConfigManager;

  constructor(configManager?: ConfigManager) {
    this.configManager = configManager ?? new ConfigManager();
  }

  /**
   * Load MCP server configurations
   */
  async loadServers(): Promise<MCPServerConfig[]> {
    try {
      const config = this.configManager.getConfig();
      const servers = config.mcp?.servers || {};

      return Object.entries(servers).map(([name, server]) => ({
        name,
        enabled: server.enabled ?? false,
        command: server.command,
        args: server.args || [],
        env: server.env,
        type: server.type || 'custom',
      }));
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      return [];
    }
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverConfig: MCPServerConfig): Promise<MCPConnection> {
    if (!serverConfig.name) {
      throw new Error('Server name is required');
    }

    if (this.connections.has(serverConfig.name)) {
      const existing = this.connections.get(serverConfig.name)!;
      if (existing.connected) {
        return existing;
      }
      await this.disconnect(serverConfig.name);
    }

    // Substitute environment variables in server config
    const processedConfig = substituteEnvVarsInObject(serverConfig, { strict: true });

    // Create transport
    const transport = new StdioClientTransport({
      command: processedConfig.command!,
      args: processedConfig.args || [],
      env: {
        ...(Object.fromEntries(
          Object.entries(process.env).filter(([_, v]) => v !== undefined)
        ) as Record<string, string>),
        ...processedConfig.env,
      },
    });

    // Create client
    const client = new Client(
      {
        name: 'jindo',
        version: '0.1.0',
      },
      {
        capabilities: {
          sampling: {},
        },
      }
    );

    // Connect
    await client.connect(transport);

    // Get available tools
    const toolsResponse = await client.listTools();
    const tools: MCPToolDefinition[] = (toolsResponse.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      serverName: serverConfig.name || 'unknown',
    }));

    const connection: MCPConnection = {
      server: serverConfig,
      client,
      transport,
      tools,
      connected: true,
    };

    this.connections.set(serverConfig.name, connection);
    return connection;
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (connection) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error(`Error disconnecting from ${serverName}:`, error);
      }
      this.connections.delete(serverName);
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((name) => this.disconnect(name));
    await Promise.all(promises);
  }

  /**
   * Get connection for a server
   */
  getConnection(serverName: string): MCPConnection | undefined {
    return this.connections.get(serverName);
  }

  /**
   * Get all connections
   */
  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all tools from all connected servers
   */
  getAllTools(): MCPToolDefinition[] {
    const allTools: MCPToolDefinition[] = [];
    for (const connection of this.connections.values()) {
      if (connection.connected) {
        allTools.push(...connection.tools);
      }
    }
    return allTools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): MCPToolDefinition[] {
    const connection = this.connections.get(serverName);
    return connection?.tools || [];
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (!serverName) {
      throw new Error('Server name is required');
    }

    const connection = this.connections.get(serverName);
    if (!connection || !connection.connected) {
      throw new Error(`Not connected to server: ${serverName}`);
    }

    const result = await connection.client.callTool({
      name: toolName,
      arguments: args,
    });

    return result.content;
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    const connection = this.connections.get(serverName);
    return connection?.connected ?? false;
  }

  /**
   * Get server status
   */
  getServerStatus(serverName: string): {
    connected: boolean;
    toolCount: number;
    lastError?: string;
  } {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return { connected: false, toolCount: 0 };
    }

    return {
      connected: connection.connected,
      toolCount: connection.tools.length,
    };
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): Record<
    string,
    {
      connected: boolean;
      toolCount: number;
      lastError?: string;
    }
  > {
    const statuses: Record<string, { connected: boolean; toolCount: number; lastError?: string }> =
      {};

    for (const [name, connection] of this.connections) {
      statuses[name] = {
        connected: connection.connected,
        toolCount: connection.tools.length,
      };
    }

    return statuses;
  }
}
