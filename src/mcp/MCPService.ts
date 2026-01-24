import { MCPRegistry } from './MCPRegistry.js';
import { MCPToolWrapper } from './MCPToolWrapper.js';
import { ConfigManager } from '../config/ConfigManager.js';
import type { MCPServerConfig } from '../config/types/config.js';

export interface MCPServiceOptions {
  configManager?: ConfigManager;
}

export interface ServiceStatus {
  connectedServers: string[];
  totalTools: number;
  toolErrors: Record<string, string>;
  lastUpdate: Date;
}

export class MCPService {
  private registry: MCPRegistry;
  private wrapper: MCPToolWrapper;
  private configManager: ConfigManager;
  private initialized = false;

  constructor(options: MCPServiceOptions = {}) {
    this.configManager = options.configManager ?? new ConfigManager();
    this.registry = new MCPRegistry(this.configManager);
    this.wrapper = new MCPToolWrapper({ registry: this.registry });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const servers = await this.registry.loadServers();
      const enabledServers = servers.filter((server) => server.enabled);

      for (const server of enabledServers) {
        try {
          await this.registry.connect(server);
        } catch (error) {
          console.warn(`Failed to connect to MCP server "${server.name}":`, error);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize MCP service:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    await this.registry.disconnectAll();
    this.initialized = false;
  }

  async reloadServers(): Promise<void> {
    await this.shutdown();
    await this.initialize();
  }

  getRegistry(): MCPRegistry {
    return this.registry;
  }

  getWrapper(): MCPToolWrapper {
    return this.wrapper;
  }

  getStatus(): ServiceStatus {
    const connections = this.registry.getAllConnections();
    const connectedServers = connections
      .filter((conn) => conn.connected)
      .map((conn) => conn.server.name || 'unknown');

    const totalTools = this.wrapper.getTools().length;
    const toolErrors: Record<string, string> = {};

    for (const connection of connections) {
      if (!connection.connected && connection.server.enabled) {
        toolErrors[connection.server.name || 'unknown'] = 'Connection failed';
      }
    }

    return {
      connectedServers,
      totalTools,
      toolErrors,
      lastUpdate: new Date(),
    };
  }

  async enableServer(serverName: string): Promise<void> {
    if (!this.registry.isConnected(serverName)) {
      const servers = await this.registry.loadServers();
      const server = servers.find((s) => s.name === serverName);

      if (server) {
        server.enabled = true;
        await this.registry.connect(server);
      } else {
        throw new Error(`Server not found: ${serverName}`);
      }
    }
  }

  async disableServer(serverName: string): Promise<void> {
    await this.registry.disconnect(serverName);
  }

  async addServer(serverConfig: MCPServerConfig): Promise<void> {
    const config = this.configManager.getConfig();
    if (!config.mcp?.servers) {
      config.mcp = { servers: {} };
    }
    const serverName = serverConfig.name || 'unknown';
    config.mcp.servers[serverName] = serverConfig;

    if (serverConfig.enabled) {
      await this.registry.connect(serverConfig);
    }
  }

  async removeServer(serverName: string): Promise<void> {
    await this.registry.disconnect(serverName);
  }

  listServers(): Array<{
    name: string;
    enabled: boolean;
    connected: boolean;
    toolCount: number;
  }> {
    const connections = this.registry.getAllConnections();
    const serverMap = new Map(connections.map((conn) => [conn.server.name || 'unknown', conn]));

    return Array.from(serverMap.entries()).map(([name, connection]) => ({
      name,
      enabled: connection.server.enabled,
      connected: connection.connected,
      toolCount: connection.tools.length,
    }));
  }

  listTools(): Array<{
    name: string;
    description: string;
    server: string;
    category?: string;
  }> {
    const tools = this.wrapper.getTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      server: this.wrapper.getToolServer(tool.name) || 'unknown',
      category: 'mcp',
    }));
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.wrapper.executeTool(toolName, args);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const status = this.getStatus();

    if (!this.initialized) {
      issues.push('MCP service not initialized');
    }

    if ((Object.keys(status.toolErrors) as string[]).length > 0) {
      for (const [server, error] of Object.entries(status.toolErrors)) {
        issues.push(`Server ${server}: ${error}`);
      }
    }

    if (status.connectedServers.length < 1) {
      issues.push('No MCP servers connected');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
