import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PromptManager } from '../src/prompts/PromptManager.js';
import { ConfigManager } from '../src/config/ConfigManager.js';

describe('PromptManager', () => {
  const testDir = '/tmp/jindo-test-prompts';
  const configManager = new ConfigManager({ configPath: testDir });

  describe('constructor', () => {
    it('should create prompt directories if they do not exist', () => {
      const promptManager = new PromptManager(configManager);

      expect(existsSync(join(testDir, 'prompts'))).toBe(true);
      expect(existsSync(join(testDir, 'prompts', 'system.md'))).toBe(true);
      expect(existsSync(join(testDir, 'prompts', 'function.md'))).toBe(true);
    });
  });

  describe('getSystemPrompt', () => {
    it('should return built-in prompt by default', async () => {
      const promptManager = new PromptManager(configManager);
      const systemPrompt = await promptManager.getSystemPrompt();

      expect(systemPrompt).toContain('You are Jindo, a helpful AI assistant');
      expect(systemPrompt).toContain('MCP protocol');
    });
  });

  describe('saveUserPrompt', () => {
    it('should save user prompt', async () => {
      const promptManager = new PromptManager(configManager);

      const testPromptPath = join(testDir, 'test-system.md');
      const testContent = 'Test system prompt';
      require('node:fs').writeFileSync(testPromptPath, testContent);

      await promptManager.saveUserPrompt('system.md', 'Custom system prompt');

      const savedContent = require('node:fs').readFileSync(
        join(testDir, 'prompts', 'system.md'),
        'utf-8'
      );

      expect(savedContent).toBe('Custom system prompt');

      require('node:fs').unlinkSync(testPromptPath);
    });
  });

  describe('listPrompts', () => {
    it('should return available prompts', async () => {
      const promptManager = new PromptManager(configManager);

      const promptList = await promptManager.listPrompts();

      expect(Array.isArray(promptList)).toBe(true);
      expect(promptList.length).toBeGreaterThan(0);
    });
  });
});
