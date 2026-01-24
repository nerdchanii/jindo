import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { MCPServerConfig } from '../config/types/config.js';

const unlinkAsync = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

interface ProcessCleanupOptions {
  force?: boolean;
  timeout?: number;
}

interface CleanupResult {
  success: boolean;
  errors: string[];
  cleaned: string[];
}

export class MCPServerCleanup {
  private static readonly PROCESSES_TO_CHECK = ['node', 'python', 'python3', 'deno', 'bun', 'npx'];

  private static readonly TEMP_DIRS = ['/tmp', '/var/tmp', process.env.TMPDIR || '/tmp'];

  private static async findRelatedProcesses(serverName: string): Promise<number[]> {
    const pids: number[] = [];

    try {
      if (process.platform !== 'win32') {
        const output = child_process.execSync('ps aux', { encoding: 'utf8' });
        const lines = output.split('\n');

        for (const line of lines) {
          if (
            line.includes(serverName) ||
            line.includes('mcp') ||
            line.includes('modelcontextprotocol')
          ) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
              const pid = parseInt(parts[1], 10);
              if (!isNaN(pid)) {
                pids.push(pid);
              }
            }
          }
        }
      } else {
        const output = child_process.execSync(
          `wmic process where "commandline like '%${serverName}%'" get processid,commandline`,
          { encoding: 'utf8' }
        );
        const lines = output.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            const parts = line.split(/\s+/);
            if (parts.length >= 1) {
              const pid = parseInt(parts[0], 10);
              if (!isNaN(pid)) {
                pids.push(pid);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to find processes for server ${serverName}:`, error);
    }

    return [...new Set(pids)];
  }

  private static async killProcesses(
    pids: number[],
    options: ProcessCleanupOptions = {}
  ): Promise<string[]> {
    const killed: string[] = [];
    const { timeout = 5000 } = options;

    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
        killed.push(`Sent SIGTERM to process ${pid}`);

        await new Promise((resolve) => setTimeout(resolve, timeout));

        try {
          process.kill(pid, 0);
        } catch {
          continue;
        }

        process.kill(pid, 'SIGKILL');
        killed.push(`Sent SIGKILL to process ${pid}`);
      } catch (error) {
        killed.push(`Failed to kill process ${pid}: ${error}`);
      }
    }

    return killed;
  }

  private static async findTempFiles(serverName: string): Promise<string[]> {
    const tempFiles: string[] = [];

    for (const tempDir of this.TEMP_DIRS) {
      try {
        if (fs.existsSync(tempDir)) {
          const files = await readdir(tempDir);
          for (const file of files) {
            if (file.includes(serverName) || file.includes('mcp') || file.includes('tmp')) {
              tempFiles.push(path.join(tempDir, file));
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to check temp directory ${tempDir}:`, error);
      }
    }

    return tempFiles;
  }

  private static async removeTempFiles(files: string[]): Promise<string[]> {
    const removed: string[] = [];

    for (const file of files) {
      try {
        const stat = await fs.promises.stat(file);
        if (stat.isFile()) {
          await unlinkAsync(file);
          removed.push(`Removed file: ${file}`);
        } else if (stat.isDirectory()) {
          await fs.promises.rm(file, { recursive: true, force: true });
          removed.push(`Removed directory: ${file}`);
        }
      } catch (error) {
        removed.push(`Failed to remove ${file}: ${error}`);
      }
    }

    return removed;
  }

  static async cleanup(
    serverConfig: MCPServerConfig,
    options: ProcessCleanupOptions = {}
  ): Promise<CleanupResult> {
    const { force = false, timeout = 5000 } = options;
    const errors: string[] = [];
    const cleaned: string[] = [];
    const serverName = serverConfig.name || 'unknown';

    try {
      console.log(`Starting cleanup for MCP server: ${serverName}`);

      const pids = await this.findRelatedProcesses(serverName);

      if (pids.length > 0) {
        console.log(`Found ${pids.length} related processes: ${pids.join(', ')}`);

        if (force) {
          for (const pid of pids) {
            try {
              await treeKill(pid, 'SIGKILL');
              cleaned.push(`Force killed process tree: ${pid}`);
            } catch (error) {
              errors.push(`Failed to kill process tree ${pid}: ${error}`);
            }
          }
        } else {
          const killResults = await this.killProcesses(pids, { timeout });
          cleaned.push(...killResults);
        }
      }

      const tempFiles = await this.findTempFiles(serverName);

      if (tempFiles.length > 0) {
        console.log(`Found ${tempFiles.length} temporary files to clean`);
        const removeResults = await this.removeTempFiles(tempFiles);
        cleaned.push(...removeResults);
      }

      await this.cleanupOrphanedResources(serverName, cleaned, errors);

      console.log(`Cleanup completed for ${serverName}`);
      return {
        success: errors.length === 0,
        errors,
        cleaned,
      };
    } catch (error) {
      errors.push(`Cleanup failed: ${error}`);
      return {
        success: false,
        errors,
        cleaned,
      };
    }
  }

  private static async cleanupOrphanedResources(
    serverName: string,
    cleaned: string[],
    errors: string[]
  ): Promise<void> {
    if (process.platform === 'win32') {
      return;
    }

    try {
      const orphanedSockets = await this.findOrphanedSockets(serverName);
      for (const socket of orphanedSockets) {
        try {
          await fs.promises.unlink(socket);
          cleaned.push(`Removed orphaned socket: ${socket}`);
        } catch (error) {
          errors.push(`Failed to remove socket ${socket}: ${error}`);
        }
      }

      const orphanedPipes = await this.findOrphanedPipes(serverName);
      for (const pipe of orphanedPipes) {
        try {
          await fs.promises.unlink(pipe);
          cleaned.push(`Removed orphaned pipe: ${pipe}`);
        } catch (error) {
          errors.push(`Failed to remove pipe ${pipe}: ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Orphaned resource cleanup failed: ${error}`);
    }
  }

  private static async findOrphanedSockets(serverName: string): Promise<string[]> {
    try {
      const output = child_process.execSync(
        'find /tmp -name "*.sock" -type s 2>/dev/null || true',
        { encoding: 'utf8' }
      );
      return output
        .split('\n')
        .filter(Boolean)
        .filter((socket) => socket.includes(serverName) || socket.includes('mcp'));
    } catch {
      return [];
    }
  }

  private static async findOrphanedPipes(serverName: string): Promise<string[]> {
    try {
      const output = child_process.execSync(
        'find /tmp -name "*.pipe" -type p 2>/dev/null || true',
        { encoding: 'utf8' }
      );
      return output
        .split('\n')
        .filter(Boolean)
        .filter((pipe) => pipe.includes(serverName) || pipe.includes('mcp'));
    } catch {
      return [];
    }
  }

  static async forceCleanupAll(): Promise<CleanupResult> {
    const errors: string[] = [];
    const cleaned: string[] = [];

    try {
      const output =
        process.platform === 'win32'
          ? child_process.execSync('wmic process get processid,commandline', { encoding: 'utf8' })
          : child_process.execSync('ps aux', { encoding: 'utf8' });

      const lines = output.split('\n');
      const pids: number[] = [];

      for (const line of lines) {
        if (
          line.includes('mcp') ||
          line.includes('modelcontextprotocol') ||
          (line.includes('node') && line.includes('server'))
        ) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const pid = parseInt(parts[1], 10);
            if (!isNaN(pid)) {
              pids.push(pid);
            }
          }
        }
      }

      for (const pid of pids) {
        try {
          await treeKill(pid, 'SIGKILL');
          cleaned.push(`Force killed MCP-related process: ${pid}`);
        } catch (error) {
          errors.push(`Failed to kill process ${pid}: ${error}`);
        }
      }

      console.log(`Force cleanup completed. Killed ${pids.length} processes.`);
    } catch (error) {
      errors.push(`Force cleanup failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      errors,
      cleaned,
    };
  }

  static async checkRunningProcesses(serverName: string): Promise<{
    running: boolean;
    pids: number[];
  }> {
    const pids = await this.findRelatedProcesses(serverName);

    return {
      running: pids.length > 0,
      pids,
    };
  }

  static async getResourceUsage(): Promise<{
    memory: number;
    cpu: number;
    processes: number;
  }> {
    try {
      if (process.platform === 'win32') {
        const memOutput = child_process.execSync('wmic OS get TotalVisibleMemorySize', {
          encoding: 'utf8',
        });
        const totalMemory = parseFloat(memOutput.split('\n')[1]?.trim() || '0');

        const cpuOutput = child_process.execSync('wmic cpu get loadpercentage', {
          encoding: 'utf8',
        });
        const cpuUsage = parseFloat(cpuOutput.split('\n')[1]?.trim() || '0');

        return {
          memory: totalMemory,
          cpu: cpuUsage,
          processes: 0,
        };
      } else {
        const memOutput = child_process.execSync('cat /proc/meminfo | grep MemTotal', {
          encoding: 'utf8',
        });
        const totalMemory = parseFloat(memOutput.split(':')[1]?.trim().split(' ')[0] || '0') / 1024;

        const cpuOutput = child_process.execSync(
          'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%id.*/\\1/" | head -1',
          { encoding: 'utf8' }
        );
        const cpuUsage = parseFloat(cpuOutput.trim() || '0');

        return {
          memory: totalMemory,
          cpu: cpuUsage,
          processes: 0,
        };
      }
    } catch {
      return {
        memory: 0,
        cpu: 0,
        processes: 0,
      };
    }
  }
}
