import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaAdapter } from './OllamaAdapter.js';

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:3b',
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default baseUrl', () => {
      const defaultAdapter = new OllamaAdapter({ model: 'test:model' });
      expect(defaultAdapter.getModelInfo().id).toBe('ollama:test:model');
    });

    it('should parse model name correctly', () => {
      adapter = new OllamaAdapter({ model: 'llama3.2:3b' });
      expect(adapter.getModelInfo().name).toBe('llama3.2');
    });
  });

  describe('getModelInfo', () => {
    it('should return correct model info', () => {
      const info = adapter.getModelInfo();
      expect(info.id).toBe('ollama:llama3.2:3b');
      expect(info.name).toBe('llama3.2');
      expect(info.provider).toBe('ollama');
      expect(info.supportsFunctionCalling).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true when server is available', async () => {
      // Mock successful fetch
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ version: '0.1.0' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ modelfile: '# FROM llama3.2:3b' }) });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when server is not available', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when model is not available', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ version: '0.1.0' }) })
        .mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('complete', () => {
    it('should throw error for unsupported function calling', async () => {
      await expect(adapter.generateToolCalls()).rejects.toThrow(
        'generateToolCalls is not supported in OllamaAdapter'
      );
    });
  });
});
