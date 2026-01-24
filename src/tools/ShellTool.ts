import { spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool, ToolParameters, ToolResult } from './BaseTool.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
}

export class ShellTool extends BaseTool {
  private runningProcesses = new Map<number, ChildProcess>();
  private processCounter = 0;

  constructor() {
    super('shell', 'Execute shell commands and manage processes');
  }

  getSchema() {
    return {
      name: 'shell',
      description: 'Execute shell commands and manage processes',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute'
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments',
            default: []
          },
          cwd: {
            type: 'string',
            description: 'Working directory',
            default: null
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds',
            default: 30000
          },
          shell: {
            type: 'boolean',
            description: 'Use shell (true) or direct exec (false)',
            default: true
          },
          background: {
            type: 'boolean',
            description: 'Run command in background',
            default: false
          },
          pid: {
            type: 'number',
            description: 'Process ID for background process management',
            default: null
          },
          action: {
            type: 'string',
            enum: ['execute', 'kill', 'list', 'status'],
            description: 'Action to perform',
            default: 'execute'
          }
        },
        required: ['command', 'action']
      }
    };
  }

  async execute(params: ToolParameters): Promise<ToolResult> {
    const { action } = params;

    try {
      switch (action) {
        case 'execute':
          return await this.executeCommand(params);
        case 'kill':
          return await this.killProcess(params);
        case 'list':
          return await this.listProcesses();
        case 'status':
          return await this.getProcessStatus(params);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return { success: false, error: `Shell action failed: ${error}` };
    }
  }

  private async executeCommand(params: ToolParameters): Promise<ToolResult> {
    const { command, args = [], cwd, timeout = 30000, shell = true, background = false } = params;

    if (typeof command !== 'string') {
      return { success: false, error: 'Command must be a string' };
    }

    try {
      this.log(`Executing: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args as string[], {
        cwd: cwd as string || process.cwd(),
        shell,
        stdio: background ? ['ignore', 'pipe', 'pipe'] : 'pipe',
        detached: background
      });

      const processId = ++this.processCounter;
      this.runningProcesses.set(processId, child);

      if (background) {
        child.unref();
        this.logSuccess(`Background process started: PID ${child.pid}, ID ${processId}`);
        return { 
          success: true, 
          data: { 
            processId, 
            pid: child.pid, 
            background: true,
            command: `${command} ${args.join(' ')}`
          } 
        };
      }

      const result = await this.waitForCommand(child, timeout);
      this.runningProcesses.delete(processId);

      if (result.exitCode === 0) {
        this.logSuccess(`Command completed successfully`);
        return { success: true, data: result };
      } else {
        this.logError(`Command failed with exit code: ${result.exitCode}`);
        return { 
          success: false, 
          error: `Command failed with exit code ${result.exitCode}`,
          data: result 
        };
      }

    } catch (error) {
      this.logError(`Failed to execute command: ${error}`);
      return { success: false, error: `Failed to execute command: ${error}` };
    }
  }

  private async killProcess(params: ToolParameters): Promise<ToolResult> {
    const { pid } = params;

    if (!pid) {
      return { success: false, error: 'PID parameter is required for kill action' };
    }

    try {
      this.log(`Killing process: ${pid}`);
      process.kill(pid, 'SIGTERM');
      
      // Wait a bit and force kill if still running
      setTimeout(() => {
        try {
          process.kill(pid, 0); // Check if still running
          process.kill(pid, 'SIGKILL');
          this.logSuccess(`Force killed process: ${pid}`);
        } catch {
          // Process already dead
        }
      }, 5000);

      this.logSuccess(`Kill signal sent to process: ${pid}`);
      return { success: true, data: `Kill signal sent to process ${pid}` };

    } catch (error) {
      this.logError(`Failed to kill process: ${error}`);
      return { success: false, error: `Failed to kill process: ${error}` };
    }
  }

  private async listProcesses(): Promise<ToolResult> {
    try {
      const processes = Array.from(this.runningProcesses.entries()).map(([id, child]) => ({
        processId: id,
        pid: child.pid,
        command: child.spawnfile,
        args: child.spawnargs,
        status: child.killed ? 'killed' : 'running'
      }));

      this.logSuccess(`Listed ${processes.length} running processes`);
      return { success: true, data: processes };

    } catch (error) {
      this.logError(`Failed to list processes: ${error}`);
      return { success: false, error: `Failed to list processes: ${error}` };
    }
  }

  private async getProcessStatus(params: ToolParameters): Promise<ToolResult> {
    const { processId } = params;

    if (!processId) {
      return { success: false, error: 'Process ID is required for status action' };
    }

    try {
      const child = this.runningProcesses.get(processId as number);
      if (!child) {
        return { success: false, error: `Process ${processId} not found` };
      }

      const status = {
        processId,
        pid: child.pid,
        command: child.spawnfile,
        args: child.spawnargs,
        status: child.killed ? 'killed' : 'running',
        connected: child.connected
      };

      this.logSuccess(`Status retrieved for process: ${processId}`);
      return { success: true, data: status };

    } catch (error) {
      this.logError(`Failed to get process status: ${error}`);
      return { success: false, error: `Failed to get process status: ${error}` };
    }
  }

  private waitForCommand(child: ChildProcess, timeout: number): Promise<CommandResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill('SIGTERM');
          resolve({
            stdout,
            stderr,
            exitCode: null,
            signal: 'SIGTERM'
          });
        }
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('exit', (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            stdout,
            stderr,
            exitCode: code,
            signal
          });
        }
      });

      child.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            stdout,
            stderr: stderr + error.message,
            exitCode: 1,
            signal: null
          });
        }
      });
    });
  }

  /**
   * Clean up all running processes
   */
  cleanup(): void {
    for (const [id, child] of this.runningProcesses) {
      try {
        child.kill('SIGTERM');
        this.log(`Cleaned up process: ${id}`);
      } catch (error) {
        this.logError(`Failed to cleanup process ${id}: ${error}`);
      }
    }
    this.runningProcesses.clear();
  }
}
