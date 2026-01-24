/**
 * Tool Executor
 * Executes tools and manages their results
 */

import type { ToolDefinition } from '../models/types/provider.js';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Tool ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Execution result */
  result: unknown;
  /** Whether execution was successful */
  success: boolean;
  /** Error if execution failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Tool function signature
 */
export interface ToolFunction {
  /** Tool definition */
  definition: ToolDefinition;
  /** Tool handler function */
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Tool executor options
 */
export interface ToolExecutorOptions {
  /** Enable timeout for tool execution */
  enableTimeout?: boolean;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Enable result caching */
  enableCache?: boolean;
}

/**
 * Tool executor
 * Manages available tools and executes them
 */
export class ToolExecutor {
  private tools: Map<string, ToolFunction> = new Map();
  private cache: Map<string, { result: unknown; timestamp: number }> = new Map();
  private enableTimeout: boolean;
  private defaultTimeout: number;
  private enableCache: boolean;
  private cacheTtl: number = 5 * 60 * 1000; // 5 minutes

  constructor(options: ToolExecutorOptions = {}) {
    this.enableTimeout = options.enableTimeout ?? true;
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.enableCache = options.enableCache ?? true;
  }

  /**
   * Register a tool
   */
  register(tool: ToolFunction): void {
    const { definition } = tool;
    this.tools.set(definition.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerMany(tools: ToolFunction[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tool definition by name
   */
  getTool(name: string): ToolFunction | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions
   */
  getAllTools(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      definitions.push(tool.definition);
    }
    return definitions;
  }

  /**
   * Execute a tool by name
   */
  async execute(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        id: crypto.randomUUID(),
        name,
        args,
        result: null,
        success: false,
        error: `Tool '${name}' not found`,
        executionTime: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = `${name}:${JSON.stringify(args)}`;
      if (this.enableCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        // Check if cache is still valid
        if (Date.now() - cached.timestamp < this.cacheTtl) {
          return {
            id: crypto.randomUUID(),
            name,
            args,
            result: cached.result,
            success: true,
            executionTime: Date.now() - startTime,
          };
        } else {
          this.cache.delete(cacheKey);
        }
      }

      // Execute tool with timeout
      let result: unknown;
      if (this.enableTimeout) {
        result = await this.executeWithTimeout(
          tool.handler,
          args,
          this.defaultTimeout
        );
      } else {
        result = await tool.handler(args);
      }

      // Cache result
      if (this.enableCache) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }

      const executionTime = Date.now() - startTime;

      return {
        id: crypto.randomUUID(),
        name,
        args,
        result,
        success: true,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        id: crypto.randomUUID(),
        name,
        args,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout<T>(
    fn: (args: Record<string, unknown>) => Promise<T>,
    args: Record<string, unknown>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(args),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timeout (${timeout}ms)`)), timeout)
      ),
    ]) as Promise<T>;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeMany(
    executions: Array<{ name: string; args: Record<string, unknown> }>
  ): Promise<ToolExecutionResult[]> {
    const promises = executions.map(({ name, args }) =>
      this.execute(name, args)
    );
    return Promise.all(promises);
  }

  /**
   * Check if tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Clear tool cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  clearTools(): void {
    this.tools.clear();
    this.cache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTtl) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.cache.delete(key);
    }

    return expired.length;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Track this in production
      misses: 0,
    };
  }
}
