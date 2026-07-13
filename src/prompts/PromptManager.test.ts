import { describe, it, expect, beforeEach } from 'vitest';
import { PromptManager } from './PromptManager.js';
import { ConfigManager } from '../config/ConfigManager.js';
import fs from 'fs/promises';
import path from 'path';

describe('PromptManager', () => {
  let promptManager: PromptManager;
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    tempDir = path.join(__dirname, '..', '..', 'temp', 'prompts');

    // Clean up any existing temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    // Create temp directory for user prompts
    await fs.mkdir(tempDir, { recursive: true });

    promptManager = new PromptManager(configManager);
    // Override prompts path to temp directory for testing
    (promptManager as any).userPromptsPath = tempDir;
    (promptManager as any).builtinPromptsPath = path.join(__dirname, '..', '..', 'src', 'prompts');
  });

  it('should return builtin system prompt when no user override exists', async () => {
    const prompt = await promptManager.getSystemPrompt();
    expect(prompt).toContain('You are Jindo, an intelligent assistant');
    expect(prompt).toContain('Current model: {model}');
  });

  it('should return builtin function prompt when no user override exists', async () => {
    const prompt = await promptManager.getFunctionPrompt();
    expect(prompt).toContain('You are a function calling assistant for Jindo');
    expect(prompt).toContain('{tools}');
  });

  it('should use user override when exists', async () => {
    const userPrompt = 'Custom system prompt for testing';
    await fs.writeFile(path.join(tempDir, 'system.md'), userPrompt);

    const prompt = await promptManager.getSystemPrompt();
    expect(prompt).toBe('Custom system prompt for testing');
  });

  it('should extract version from prompt content', async () => {
    const promptWithVersion = '// @version 1.2.3\nSome content';
    const version = await (promptManager as any).extractVersion(promptWithVersion);
    expect(version).toBe('1.2.3');
  });

  it('should return default version when no version specified', async () => {
    const promptWithoutVersion = 'Just some content';
    const version = await (promptManager as any).extractVersion(promptWithoutVersion);
    expect(version).toBe('1.0.0');
  });

  it('should list available prompts', async () => {
    await fs.writeFile(path.join(tempDir, 'custom.md'), 'Custom prompt');

    const prompts = await promptManager.listPrompts();
    const promptNames = prompts.map((p) => p.name).sort();
    const expectedNames = ['system', 'function', 'custom'].sort();

    expect(promptNames).toEqual(expectedNames);
    expect(prompts.find((p) => p.name === 'custom')?.hasUserOverride).toBe(true);
    // system and function are builtin, so no user override (they only exist in builtin dir)
    expect(prompts.find((p) => p.name === 'system')?.hasUserOverride).toBe(false);
  });

  it('should save user prompt', async () => {
    const content = 'Test user prompt';
    await promptManager.saveUserPrompt('test.md', content);

    const savedContent = await fs.readFile(path.join(tempDir, 'test.md'), 'utf-8');
    expect(savedContent).toBe(content);
  });

  it('should reset user prompt', async () => {
    await fs.writeFile(path.join(tempDir, 'system.md'), 'User prompt');

    await promptManager.resetPrompt('system.md');

    await expect(fs.readFile(path.join(tempDir, 'system.md'), 'utf-8')).rejects.toThrow('ENOENT');
  });
});
