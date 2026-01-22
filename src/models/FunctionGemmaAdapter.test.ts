import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FunctionGemmaAdapter } from './FunctionGemmaAdapter.js';

describe('FunctionGemmaAdapter', () => {
  let adapter: FunctionGemmaAdapter;

  beforeEach(() => {
    adapter = new FunctionGemmaAdapter({
      baseUrl: 'http://localhost:11434',
      model: 'functiongemma:270m',
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      const defaultAdapter = new FunctionGemmaAdapter();
      expect(defaultAdapter.getModelInfo().id).toBe('ollama:functiongemma:270m');
    });

    it('should set correct model info', () => {
      const info = adapter.getModelInfo();
      expect(info.provider).toBe('ollama');
      expect(info.supportsFunctionCalling).toBe(true);
      expect(info.contextLength).toBe(4096);
    });
  });

  describe('getModelInfo', () => {
    it('should return correct model info', () => {
      const info = adapter.getModelInfo();
      expect(info.name).toBe('functiongemma');
      expect(info.id).toBe('ollama:functiongemma:270m');
    });
  });

  describe('isAvailable', () => {
    it('should return true when server is available', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ version: '0.1.0' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ modelfile: '# FROM functiongemma:270m' }) });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when server is not available', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('generateToolCalls', () => {
    it('should call Ollama API with correct format', async () => {
      const mockResponse = {
        model: 'functiongemma:270m',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'I need to call a function',
          tool_calls: [
            {
              id: 'call-1',
              function: {
                name: 'search',
                arguments: '{"query": "test"}',
              },
            },
          ],
        },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.generateToolCalls({
        tools: [
          {
            name: 'search',
            description: 'Search for something',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
            },
          },
        ],
        messages: [{ role: 'user', content: 'Search for test' }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search');
      expect(result.toolCalls[0].arguments).toBe('{"query": "test"}');
      expect(result.usage.totalTokens).toBe(30);
    });

    it('should handle empty tool calls', async () => {
      const mockResponse = {
        model: 'functiongemma:270m',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'No tool call needed',
        },
        done: true,
        prompt_eval_count: 5,
        eval_count: 5,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.generateToolCalls({
        tools: [],
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.toolCalls).toHaveLength(0);
      expect(result.reasoning).toBe('No tool call needed');
    });
  });
});
