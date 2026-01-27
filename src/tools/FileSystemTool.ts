import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { BaseTool, ToolParameters, ToolResult } from './BaseTool.js';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.access);

export class FileSystemTool extends BaseTool {
  constructor() {
    super('filesystem', 'File system operations for reading, writing, and listing files');
  }

  getSchema(): {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  } {
    return {
      name: 'filesystem',
      description: 'Perform file system operations',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['read', 'write', 'list', 'exists', 'mkdir'],
            description: 'The operation to perform',
          },
          path: {
            type: 'string',
            description: 'File or directory path',
          },
          content: {
            type: 'string',
            description: 'Content to write (for write operation)',
          },
          recursive: {
            type: 'boolean',
            description: 'Recursive listing (for list operation)',
            default: false,
          },
        },
        required: ['operation', 'path'],
      },
    };
  }

  async execute(params: ToolParameters): Promise<ToolResult> {
    const { operation, path: filePath, content, recursive = false } = params;

    if (typeof filePath !== 'string') {
      return { success: false, error: 'Path parameter must be a string' };
    }

    const resolvedPath = path.resolve(filePath);

    try {
      switch (operation) {
        case 'read':
          return await this.readFile(resolvedPath);
        case 'write':
          return await this.writeFile(resolvedPath, content as string);
        case 'list':
          return await this.listFiles(resolvedPath, recursive as boolean);
        case 'exists':
          return await this.checkExists(resolvedPath);
        case 'mkdir':
          return await this.createDirectory(resolvedPath);
        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }
    } catch (error) {
      return { success: false, error: `${operation} failed: ${error}` };
    }
  }

  private async readFile(filePath: string): Promise<ToolResult> {
    try {
      this.log(`Reading file: ${filePath}`);
      const data = await readFileAsync(filePath, 'utf8');
      this.logSuccess(`File read successfully: ${filePath}`);
      return { success: true, data };
    } catch (error) {
      this.logError(`Failed to read file: ${error}`);
      return { success: false, error: `Failed to read file: ${error}` };
    }
  }

  private async writeFile(filePath: string, content: string): Promise<ToolResult> {
    if (typeof content !== 'string') {
      return { success: false, error: 'Content parameter must be a string for write operation' };
    }

    try {
      this.log(`Writing file: ${filePath}`);
      await writeFileAsync(filePath, content, 'utf8');
      this.logSuccess(`File written successfully: ${filePath}`);
      return { success: true, data: 'File written successfully' };
    } catch (error) {
      this.logError(`Failed to write file: ${error}`);
      return { success: false, error: `Failed to write file: ${error}` };
    }
  }

  private async listFiles(dirPath: string, recursive: boolean): Promise<ToolResult> {
    try {
      this.log(`Listing directory: ${dirPath} (recursive: ${recursive})`);

      if (!recursive) {
        const files = await readdirAsync(dirPath);
        const fileStats = await Promise.all(
          files.map(async (file) => {
            const fullPath = path.join(dirPath, file);
            try {
              const stats = await statAsync(fullPath);
              return {
                name: file,
                path: fullPath,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
              };
            } catch {
              return {
                name: file,
                path: fullPath,
                type: 'unknown',
                size: 0,
              };
            }
          })
        );
        this.logSuccess(`Directory listed: ${files.length} items`);
        return { success: true, data: fileStats };
      } else {
        const items = await this.listFilesRecursive(dirPath);
        this.logSuccess(`Directory listed recursively: ${items.length} items`);
        return { success: true, data: items };
      }
    } catch (error) {
      this.logError(`Failed to list directory: ${error}`);
      return { success: false, error: `Failed to list directory: ${error}` };
    }
  }

  private async listFilesRecursive(dirPath: string, currentDepth = 0): Promise<any[]> {
    const MAX_DEPTH = 10;
    if (currentDepth > MAX_DEPTH) {
      return [];
    }

    try {
      const files = await readdirAsync(dirPath);
      const items: any[] = [];

      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
          const stats = await statAsync(fullPath);
          const item = {
            name: file,
            path: fullPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            depth: currentDepth,
          };

          items.push(item);

          if (stats.isDirectory() && !file.startsWith('.') && currentDepth < MAX_DEPTH) {
            const subItems = await this.listFilesRecursive(fullPath, currentDepth + 1);
            items.push(...subItems);
          }
        } catch {
          // Skip files we can't access
        }
      }

      return items;
    } catch {
      return [];
    }
  }

  private async checkExists(filePath: string): Promise<ToolResult> {
    try {
      this.log(`Checking existence: ${filePath}`);
      await existsAsync(filePath);
      this.logSuccess(`Path exists: ${filePath}`);
      return { success: true, data: true };
    } catch {
      this.logSuccess(`Path does not exist: ${filePath}`);
      return { success: true, data: false };
    }
  }

  private async createDirectory(dirPath: string): Promise<ToolResult> {
    try {
      this.log(`Creating directory: ${dirPath}`);
      await mkdirAsync(dirPath, { recursive: true });
      this.logSuccess(`Directory created: ${dirPath}`);
      return { success: true, data: 'Directory created successfully' };
    } catch (error) {
      this.logError(`Failed to create directory: ${error}`);
      return { success: false, error: `Failed to create directory: ${error}` };
    }
  }
}
