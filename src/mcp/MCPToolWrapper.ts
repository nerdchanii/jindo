import { MCPRegistry } from './MCPRegistry.js';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolWrapperOptions {
  registry: MCPRegistry;
}

export interface MCPToolExecutor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export class MCPToolWrapper {
  private registry: MCPRegistry;

  constructor(options: MCPToolWrapperOptions) {
    this.registry = options.registry;
  }

  getTools(): ToolDefinition[] {
    const mcpTools = this.registry.getAllTools();

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: {
        type: 'object',
        properties: (tool.inputSchema?.properties as Record<string, unknown>) || {},
        required: (tool.inputSchema?.required as string[]) || [],
      },
    }));
  }

  getToolExecutors(): MCPToolExecutor[] {
    const mcpTools = this.registry.getAllTools();

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      serverName: tool.serverName,
      execute: async (args: Record<string, unknown>) => {
        return this.registry.callTool(tool.serverName, tool.name, args);
      },
    }));
  }

  getServerTools(serverName: string): ToolDefinition[] {
    const mcpTools = this.registry.getServerTools(serverName);

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: {
        type: 'object',
        properties: (tool.inputSchema?.properties as Record<string, unknown>) || {},
        required: (tool.inputSchema?.required as string[]) || [],
      },
    }));
  }

  getServerToolExecutors(serverName: string): MCPToolExecutor[] {
    const mcpTools = this.registry.getServerTools(serverName);

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      serverName: tool.serverName,
      execute: async (args: Record<string, unknown>) => {
        return this.registry.callTool(tool.serverName, tool.name, args);
      },
    }));
  }

  hasTool(toolName: string): boolean {
    const tools = this.getTools();
    return tools.some((tool) => tool.name === toolName);
  }

  getToolExecutor(toolName: string): MCPToolExecutor | undefined {
    const executors = this.getToolExecutors();
    return executors.find((executor) => executor.name === toolName);
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const executor = this.getToolExecutor(toolName);
    if (!executor) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return executor.execute(args);
  }

  getToolServer(toolName: string): string | undefined {
    const mcpTools = this.registry.getAllTools();
    const tool = mcpTools.find((t) => t.name === toolName);
    return tool?.serverName;
  }

  getToolsByServer(): Record<string, ToolDefinition[]> {
    const toolsByServer: Record<string, ToolDefinition[]> = {};
    const connections = this.registry.getAllConnections();

    for (const connection of connections) {
      if (connection.connected) {
        toolsByServer[connection.server.name || 'unknown'] = this.getServerTools(
          connection.server.name || 'unknown'
        );
      }
    }

    return toolsByServer;
  }

  getToolExecutorsByServer(): Record<string, MCPToolExecutor[]> {
    const executorsByServer: Record<string, MCPToolExecutor[]> = {};
    const connections = this.registry.getAllConnections();

    for (const connection of connections) {
      if (connection.connected) {
        executorsByServer[connection.server.name || 'unknown'] = this.getServerToolExecutors(
          connection.server.name || 'unknown'
        );
      }
    }

    return executorsByServer;
  }
}
