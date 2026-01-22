import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelSelector, MODEL_PRESETS } from './ModelSelector.js';

describe('ModelSelector', () => {
  let selector: ModelSelector;

  beforeEach(() => {
    selector = new ModelSelector({
      conversationModel: 'llama3.2:3b',
      functionModel: 'functiongemma:270m',
      baseUrl: 'http://localhost:11434',
      timeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultSelector = new ModelSelector();
      const config = defaultSelector.getConfig();
      expect(config.preset).toBe('balanced');
    });

    it('should use provided values', () => {
      const customSelector = new ModelSelector({
        conversationModel: 'llama3.1:8b',
        functionModel: 'functiongemma:270m',
      });
      const config = customSelector.getConfig();
      expect(config.conversationModel).toBe('ollama:llama3.1:8b');
    });
  });

  describe('MODEL_PRESETS', () => {
    it('should have lightweight preset', () => {
      expect(MODEL_PRESETS.lightweight.conversationModel).toBe('ollama:phi-3-mini');
      expect(MODEL_PRESETS.lightweight.functionModel).toBe('ollama:functiongemma:270m');
    });

    it('should have balanced preset', () => {
      expect(MODEL_PRESETS.balanced.conversationModel).toBe('ollama:llama3.2:3b');
      expect(MODEL_PRESETS.balanced.functionModel).toBe('ollama:functiongemma:270m');
    });

    it('should have highend preset', () => {
      expect(MODEL_PRESETS.highend.conversationModel).toBe('ollama:llama3.1:8b');
      expect(MODEL_PRESETS.highend.functionModel).toBe('ollama:functiongemma:270m');
    });
  });

  describe('initialize', () => {
    it('should return available models', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '0.1.0' }),
      });

      // Mock the isAvailable check
      vi.spyOn(selector as any, 'conversationAdapter', 'get').mockReturnValue({
        isAvailable: () => Promise.resolve(true),
        getModelInfo: () => ({ id: 'ollama:llama3.2:3b' }),
      });
      vi.spyOn(selector as any, 'functionAdapter', 'get').mockReturnValue({
        isAvailable: () => Promise.resolve(true),
        getModelInfo: () => ({ id: 'ollama:functiongemma:270m' }),
      });

      const result = await selector.initialize();
      expect(result.conversationModel).toBe('ollama:llama3.2:3b');
      expect(result.functionModel).toBe('ollama:functiongemma:270m');
    });

    it('should use fallback when primary is unavailable', async () => {
      const mockAdapter = {
        isAvailable: () => Promise.resolve(true),
        getModelInfo: () => ({ id: 'ollama:fallback-model' }),
      };

      const customSelector = new ModelSelector({
        conversationModel: 'unavailable-model',
        functionModel: 'functiongemma:270m',
        fallback: {
          conversationModel: 'fallback-model',
        },
      });

      vi.spyOn(customSelector as any, 'conversationAdapter', 'get').mockImplementation(() => ({
        isAvailable: () => Promise.resolve(false),
      }));
      vi.spyOn(customSelector as any, 'fallbackConversationAdapter', 'get').mockReturnValue(mockAdapter);

      const result = await customSelector.initialize();
      expect(result.hasFallback).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = selector.getConfig();
      expect(config.conversationModel).toBe('ollama:llama3.2:3b');
      expect(config.functionModel).toBe('ollama:functiongemma:270m');
      expect(config.preset).toBe('balanced');
    });
  });

  describe('listAvailableModels', () => {
    it('should return list of available models', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'llama3.2:3b' },
            { name: 'functiongemma:270m' },
          ],
        }),
      });

      const models = await selector.listAvailableModels();
      expect(models).toEqual(['llama3.2:3b', 'functiongemma:270m']);
    });

    it('should return empty list on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const models = await selector.listAvailableModels();
      expect(models).toEqual([]);
    });
  });

  describe('isReady', () => {
    it('should return true when both models are available', async () => {
      vi.spyOn(selector, 'isConversationModelAvailable').mockResolvedValue(true);
      vi.spyOn(selector, 'isFunctionModelAvailable').mockResolvedValue(true);

      const ready = await selector.isReady();
      expect(ready).toBe(true);
    });

    it('should return false when conversation model is unavailable', async () => {
      vi.spyOn(selector, 'isConversationModelAvailable').mockResolvedValue(false);
      vi.spyOn(selector, 'isFunctionModelAvailable').mockResolvedValue(true);

      const ready = await selector.isReady();
      expect(ready).toBe(false);
    });

    it('should return false when function model is unavailable', async () => {
      vi.spyOn(selector, 'isConversationModelAvailable').mockResolvedValue(true);
      vi.spyOn(selector, 'isFunctionModelAvailable').mockResolvedValue(false);

      const ready = await selector.isReady();
      expect(ready).toBe(false);
    });
  });

  describe('complete', () => {
    it('should throw error when not initialized', async () => {
      await expect(selector.complete({ messages: [] })).rejects.toThrow(
        'Conversation model not initialized'
      );
    });
  });

  describe('generateToolCalls', () => {
    it('should throw error when not initialized', async () => {
      await expect(
        selector.generateToolCalls({ tools: [], messages: [] })
      ).rejects.toThrow('Function model not initialized');
    });
  });

  describe('usePreset', () => {
    it('should switch to lightweight preset', async () => {
      const initSpy = vi.spyOn(selector as any, 'initialize').mockResolvedValue({});

      await selector.usePreset('lightweight');
      expect(initSpy).toHaveBeenCalled();
    });

    it('should throw error for unknown preset', async () => {
      await expect(
        (selector as any).usePreset('unknown')
      ).rejects.toThrow('Unknown preset');
    });
  });
});
