/**
 * Prompt Manager
 * Manages system prompts with versioning and user override support
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from '../config/ConfigManager.js';

/**
 * Prompt information with metadata
 */
export interface PromptInfo {
  version: string;
  content: string;
  lastModified: Date;
}

/**
 * Complete prompt set
 */
export interface PromptSet {
  system: PromptInfo;
  function: PromptInfo;
}

/**
 * Prompt Manager for handling system and function calling prompts
 */
export class PromptManager {
  private userPromptsPath: string;
  private builtinPromptsPath: string;

  constructor(configManager: ConfigManager) {
    this.userPromptsPath = path.join(configManager.getConfigDir(), 'prompts');
    // In development, use src/prompts; in production (built), use dist/prompts
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    this.builtinPromptsPath = currentDir;
  }

  /**
   * Get system prompt with versioning support
   */
  async getSystemPrompt(): Promise<string> {
    return this.getPrompt('system.md');
  }

  /**
   * Get function calling prompt with versioning support
   */
  async getFunctionPrompt(): Promise<string> {
    return this.getPrompt('function.md');
  }

  /**
   * Get complete prompt set with version information
   */
  async getPromptSet(): Promise<PromptSet> {
    const [system, func] = await Promise.all([
      this.getPromptInfo('system.md'),
      this.getPromptInfo('function.md'),
    ]);

    return {
      system: system || { version: '1.0.0', content: '', lastModified: new Date() },
      function: func || { version: '1.0.0', content: '', lastModified: new Date() },
    };
  }

  /**
   * Get prompt content with user override support
   */
  private async getPrompt(filename: string): Promise<string> {
    try {
      // Try user override first
      const userPrompt = await this.loadUserPrompt(filename);
      if (userPrompt) {
        return userPrompt;
      }
    } catch {
      // Fall back to builtin
    }

    try {
      // Try builtin prompt
      return await this.loadBuiltinPrompt(filename);
    } catch (error) {
      throw new Error(`Failed to load prompt ${filename}: ${error}`);
    }
  }

  /**
   * Get prompt info with metadata
   */
  private async getPromptInfo(filename: string): Promise<PromptInfo | null> {
    try {
      // Try user override first
      const userPromptInfo = await this.loadUserPromptInfo(filename);
      if (userPromptInfo) {
        return userPromptInfo;
      }
    } catch {
      // Fall back to builtin
    }

    try {
      // Try builtin prompt
      return await this.loadBuiltinPromptInfo(filename);
    } catch {
      return null;
    }
  }

  /**
   * Load user prompt file
   */
  private async loadUserPrompt(filename: string): Promise<string> {
    const filePath = path.join(this.userPromptsPath, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  /**
   * Load user prompt info with metadata
   */
  private async loadUserPromptInfo(filename: string): Promise<PromptInfo | null> {
    try {
      const filePath = path.join(this.userPromptsPath, filename);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        version: await this.extractVersion(content),
        content,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Load builtin prompt file
   */
  private async loadBuiltinPrompt(filename: string): Promise<string> {
    const filePath = path.join(this.builtinPromptsPath, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  }

  /**
   * Load builtin prompt info with metadata
   */
  private async loadBuiltinPromptInfo(filename: string): Promise<PromptInfo | null> {
    try {
      const filePath = path.join(this.builtinPromptsPath, filename);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        version: await this.extractVersion(content),
        content,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract version from prompt content
   */
  private async extractVersion(content: string): Promise<string> {
    const versionMatch = content.match(/^\/\/ @version\s+(.+)$/m);
    if (versionMatch) {
      return versionMatch[1].trim();
    }

    // Look for version in YAML frontmatter
    const yamlMatch = content.match(/^---\s*\nversion:\s*(.+)\n---/m);
    if (yamlMatch) {
      return yamlMatch[1].trim();
    }

    return '1.0.0'; // Default version
  }

  /**
   * Save user prompt override
   */
  async saveUserPrompt(filename: string, content: string): Promise<void> {
    await fs.mkdir(this.userPromptsPath, { recursive: true });
    const filePath = path.join(this.userPromptsPath, filename);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Get available prompts list
   */
  async listPrompts(): Promise<{ name: string; hasUserOverride: boolean }[]> {
    const builtinFiles = await this.listBuiltinPrompts();
    const userFiles = await this.listUserPrompts();

    const promptNames = new Set<string>();
    builtinFiles.forEach((file) => promptNames.add(path.basename(file, '.md')));
    userFiles.forEach((file) => promptNames.add(path.basename(file, '.md')));

    return Array.from(promptNames).map((name) => ({
      name,
      hasUserOverride: userFiles.some((file) => path.basename(file, '.md') === name),
    }));
  }

  /**
   * List builtin prompts
   */
  private async listBuiltinPrompts(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.builtinPromptsPath);
      return files.filter((file) => file.endsWith('.md'));
    } catch {
      return [];
    }
  }

  /**
   * List user prompts
   */
  private async listUserPrompts(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.userPromptsPath);
      return files.filter((file) => file.endsWith('.md'));
    } catch {
      return [];
    }
  }

  /**
   * Reset user prompt to builtin version
   */
  async resetPrompt(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.userPromptsPath, filename);
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Reset all user prompts
   */
  async resetAllPrompts(): Promise<void> {
    const userFiles = await this.listUserPrompts();
    await Promise.all(userFiles.map((file) => this.resetPrompt(file)));
  }
}
