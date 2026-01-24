/**
 * BaseTool - Abstract base class for all built-in tools
 */

export interface ToolParameters {
  [key: string]: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export abstract class BaseTool {
  protected name: string;
  protected description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Get tool name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get tool description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get tool schema for function calling
   */
  abstract getSchema(): {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };

  /**
   * Execute the tool with given parameters
   */
  abstract execute(params: ToolParameters): Promise<ToolResult>;

  /**
   * Validate parameters before execution
   */
  protected validateParams(params: ToolParameters, required: string[]): string[] {
    const errors: string[] = [];
    
    for (const req of required) {
      if (!(req in params)) {
        errors.push(`Missing required parameter: ${req}`);
      }
    }
    
    return errors;
  }

  /**
   * Log tool execution
   */
  protected log(message: string): void {
    console.log(`[🔧 ${this.name}] ${message}`);
  }

  /**
   * Log tool error
   */
  protected logError(error: string): void {
    console.error(`[❌ ${this.name}] ${error}`);
  }

  /**
   * Log tool success
   */
  protected logSuccess(message: string): void {
    console.log(`[✓ ${this.name}] ${message}`);
  }
}
