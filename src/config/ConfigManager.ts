import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { JindoConfig, MCPSettings, ConfigManagerOptions } from './types/config.js';

const DEFAULT_CONFIG_PATH = '~/.config/jindo';
const CONFIG_FILENAME = 'config.yaml';
const MCP_SETTINGS_FILENAME = 'mcp-settings.json';

/**
 * Configuration manager for Jindo agent
 * Handles config.yaml and mcp-settings.json with environment variable substitution
 */
export class ConfigManager {
  private configPath: string;
  private config: JindoConfig | null = null;
  private mcpSettings: MCPSettings | null = null;

  constructor(options: ConfigManagerOptions = {}) {
    this.configPath = options.configPath || process.env.JINDO_CONFIG_PATH || DEFAULT_CONFIG_PATH;
    this.configPath = this.configPath.replace('~', homedir());
  }

  /**
   * Get the config directory path
   */
  getConfigDir(): string {
    return this.configPath;
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return join(this.configPath, CONFIG_FILENAME);
  }

  /**
   * Get the MCP settings file path
   */
  getMCPSettingsPath(): string {
    return join(this.configPath, MCP_SETTINGS_FILENAME);
  }

  /**
   * Ensure the config directory exists
   */
  ensureConfigDir(): void {
    if (!existsSync(this.configPath)) {
      mkdirSync(this.configPath, { recursive: true });
    }
  }

  /**
   * Substitute environment variables in a string
   * Format: ${VAR_NAME} or ${VAR_NAME:default}
   */
  private substituteEnvVars(value: string): string {
    return value.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (_, varName, defaultValue) => {
      return process.env[varName] ?? defaultValue ?? '';
    });
  }

  /**
   * Substitute environment variables in an object
   */
  private substituteEnvVarsInObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.substituteEnvVars(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string' ? this.substituteEnvVars(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteEnvVarsInObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Load the main config file (config.yaml)
   */
  loadConfig(): JindoConfig {
    if (this.config) {
      return this.config;
    }

    const configPath = this.getConfigPath();

    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const content = readFileSync(configPath, 'utf-8');
    const parsed = parse(content) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid config file format: ${configPath}`);
    }

    this.config = this.substituteEnvVarsInObject(parsed) as JindoConfig;
    return this.config;
  }

  /**
   * Load MCP settings (mcp-settings.json)
   */
  loadMCPSettings(): MCPSettings {
    if (this.mcpSettings) {
      return this.mcpSettings;
    }

    const mcpPath = this.getMCPSettingsPath();

    if (!existsSync(mcpPath)) {
      throw new Error(`MCP settings file not found: ${mcpPath}`);
    }

    const content = readFileSync(mcpPath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid MCP settings format: ${mcpPath}`);
    }

    this.mcpSettings = this.substituteEnvVarsInObject(parsed) as MCPSettings;
    return this.mcpSettings;
  }

  /**
   * Save the main config file (config.yaml)
   */
  saveConfig(config: JindoConfig): void {
    this.ensureConfigDir();
    const configPath = this.getConfigPath();

    // Simple YAML serialization (for complex cases, use a proper YAML library)
    const yaml = this.configToYaml(config);
    writeFileSync(configPath, yaml, 'utf-8');
    this.config = config;
  }

  /**
   * Save MCP settings (mcp-settings.json)
   */
  saveMCPSettings(settings: MCPSettings): void {
    this.ensureConfigDir();
    const mcpPath = this.getMCPSettingsPath();

    const json = JSON.stringify(settings, null, 2);
    writeFileSync(mcpPath, json, 'utf-8');
    this.mcpSettings = settings;
  }

  /**
   * Convert config to YAML string
   * Simple implementation - for production, use a proper YAML library
   */
  private configToYaml(config: JindoConfig): string {
    const lines: string[] = [];

    lines.push('agent:');
    lines.push(`  conversationModel: ${config.agent.conversationModel}`);
    lines.push(`  functionModel: ${config.agent.functionModel}`);
    lines.push(`  outputFormat: ${config.agent.outputFormat}`);
    lines.push(`  maxHistoryMessages: ${config.agent.maxHistoryMessages}`);

    lines.push('mcp:');
    lines.push('  servers:');

    for (const [name, server] of Object.entries(config.mcp.servers)) {
      lines.push(`    ${name}:`);
      lines.push(`      enabled: ${server.enabled}`);
      lines.push(`      command: ${server.command}`);
      lines.push(`      args: [${server.args.join(', ')}]`);

      if (server.description) {
        lines.push(`      description: ${server.description}`);
      }
      if (server.type) {
        lines.push(`      type: ${server.type}`);
      }
      if (server.env) {
        lines.push('      env:');
        for (const [envKey, envValue] of Object.entries(server.env)) {
          lines.push(`        ${envKey}: ${envValue}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Get the current config (load if not loaded)
   */
  getConfig(): JindoConfig {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Get the current MCP settings (load if not loaded)
   */
  getMCPSettings(): MCPSettings {
    if (!this.mcpSettings) {
      return this.loadMCPSettings();
    }
    return this.mcpSettings;
  }

  /**
   * Check if config exists
   */
  configExists(): boolean {
    return existsSync(this.getConfigPath());
  }

  /**
   * Check if MCP settings exist
   */
  mcpSettingsExists(): boolean {
    return existsSync(this.getMCPSettingsPath());
  }
}
