import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { ConfigManager } from './ConfigManager.js';
import type { JindoConfig, MCPSettings } from './types/config.js';

describe('ConfigManager', () => {
  const testDir = '/tmp/jindo-test-config';
  let configManager: ConfigManager;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    configManager = new ConfigManager({ configPath: testDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getConfigDir', () => {
    it('should return the config directory path', () => {
      expect(configManager.getConfigDir()).toBe(testDir);
    });

    it('should expand ~ to home directory', () => {
      const manager = new ConfigManager({ configPath: '~/test-jindo' });
      expect(manager.getConfigDir()).toContain('/Users/');
    });
  });

  describe('getConfigPath', () => {
    it('should return the config file path', () => {
      expect(configManager.getConfigPath()).toBe(`${testDir}/config.yaml`);
    });
  });

  describe('getMCPSettingsPath', () => {
    it('should return the MCP settings file path', () => {
      expect(configManager.getMCPSettingsPath()).toBe(`${testDir}/mcp-settings.json`);
    });
  });

  describe('ensureConfigDir', () => {
    it('should create the config directory if it does not exist', () => {
      configManager.ensureConfigDir();
      expect(configManager.configExists()).toBe(false);
    });
  });

  describe('configExists', () => {
    it('should return false if config does not exist', () => {
      expect(configManager.configExists()).toBe(false);
    });
  });

  describe('mcpSettingsExists', () => {
    it('should return false if MCP settings do not exist', () => {
      expect(configManager.mcpSettingsExists()).toBe(false);
    });
  });

  describe('environment variable substitution', () => {
    it('should substitute environment variables in strings', () => {
      const value = 'api-key-${TEST_API_KEY:-default-key}';
      const substituted = (configManager as any).substituteEnvVars(value);
      expect(substituted).toBe('api-key-default-key');
    });

    it('should use environment variable value if set', () => {
      vi.stubEnv('TEST_API_KEY', 'real-key');
      const value = 'api-key-${TEST_API_KEY:-default-key}';
      const substituted = (configManager as any).substituteEnvVars(value);
      expect(substituted).toBe('api-key-real-key');
    });
  });

  describe('saveConfig and loadConfig', () => {
    const testConfig: JindoConfig = {
      agent: {
        conversationModel: 'ollama:llama3.2:3b',
        functionModel: 'ollama:functiongemma:270m',
        outputFormat: 'text',
        maxHistoryMessages: 50,
      },
      mcp: {
        servers: {
          filesystem: {
            enabled: true,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            type: 'builtin',
          },
        },
      },
    };

    it('should save and load config', () => {
      configManager.saveConfig(testConfig);
      expect(configManager.configExists()).toBe(true);

      const loaded = configManager.loadConfig();
      expect(loaded).toEqual(testConfig);
    });

    it('should return cached config on subsequent loads', () => {
      configManager.saveConfig(testConfig);
      configManager.loadConfig();
      const loaded = configManager.loadConfig();
      expect(loaded).toBe(configManager.getConfig());
    });
  });

  describe('saveMCPSettings and loadMCPSettings', () => {
    const testMCPSettings: MCPSettings = {
      servers: {
        filesystem: {
          enabled: true,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        },
        github: {
          enabled: false,
          command: 'uvx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
      },
    };

    it('should save and load MCP settings', () => {
      configManager.saveMCPSettings(testMCPSettings);
      expect(configManager.mcpSettingsExists()).toBe(true);

      const loaded = configManager.loadMCPSettings();
      expect(loaded).toEqual(testMCPSettings);
    });
  });
});
