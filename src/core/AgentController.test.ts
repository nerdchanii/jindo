import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentController } from './AgentController.js';
import { ModelSelector } from '../models/ModelSelector.js';

describe('AgentController', () => {
  let controller: AgentController;
  let mockModelSelector: any;

  beforeEach(() => {
    mockModelSelector = {
      initialize: vi.fn().mockResolvedValue({}),
      isReady: vi.fn().mockResolvedValue(true),
      getConversationModelInfo: vi.fn().mockReturnValue({
        id: 'ollama:test-model',
        name: 'test-model',
        provider: 'ollama',
        contextLength: 8192,
        supportsFunctionCalling: false,
      }),
      getFunctionModelInfo: vi.fn().mockReturnValue({
        id: 'ollama:functiongemma:270m',
        name: 'functiongemma',
        provider: 'ollama',
        contextLength: 4096,
        supportsFunctionCalling: true,
      }),
      complete: vi.fn().mockResolvedValue({
        message: { role: 'assistant', content: 'Test response' },
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
      completeStream: vi.fn().mockResolvedValue({ done: true, content: 'test' }),
      generateToolCalls: vi.fn().mockResolvedValue({
        toolCalls: [],
        usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
      }),
      getConfig: vi.fn().mockReturnValue({
        preset: 'balanced' as const,
        conversationModel: 'ollama:llama3.2:3b',
        functionModel: 'ollama:functiongemma:270m',
      }),
    };

    controller = new AgentController({
      config: {
        modelSelector: mockModelSelector,
      },
    });
  });

  describe('constructor', () => {
    it('should create agent with default options', () => {
      const agent = new AgentController({ config: mockModelSelector });
      expect(agent).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize model selector', async () => {
      await controller.initialize();
      expect(mockModelSelector.initialize).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await controller.initialize();
      await controller.initialize();
      expect(mockModelSelector.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('isReady', () => {
    it('should return true when initialized', async () => {
      await controller.initialize();
      const ready = await controller.isReady();
      expect(ready).toBe(true);
    });

    it('should return false when not initialized', async () => {
      const ready = await controller.isReady();
      expect(ready).toBe(false);
    });
  });

  describe('processMessage', () => {
    beforeEach(async () => {
      await controller.initialize();
    });

    it('should process user message and return response', async () => {
      const response = await controller.processMessage('Hello');
      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.tokens).toBeDefined();
      expect(response.executionTime).toBeGreaterThan(0);
    });

    it('should add user message to conversation', async () => {
      await controller.processMessage('Hello');
      const summary = controller.getConversationSummary();
      expect(summary.messageCount).toBeGreaterThan(0);
    });
  });

  describe('registerTool', () => {
    it('should register tool and add to router', () => {
      const mockTool = {
        definition: {
          name: 'test-tool',
          description: 'Test tool',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => ({ result: 'success' }),
      };

      controller.registerTool(mockTool);
      const stats = controller.getStats();
      expect(stats.tools).toBe(1);
    });
  });

  describe('registerMany', () => {
    it('should register multiple tools', () => {
      const mockTool1 = {
        definition: {
          name: 'tool1',
          description: 'Tool 1',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => ({ result: 'success1' }),
      };
      const mockTool2 = {
        definition: {
          name: 'tool2',
          description: 'Tool 2',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => ({ result: 'success2' }),
      };

      controller.registerMany([mockTool1, mockTool2]);
      const stats = controller.getStats();
      expect(stats.tools).toBe(2);
    });
  });

  describe('clearConversation', () => {
    it('should clear conversation but keep tools', async () => {
      await controller.initialize();
      await controller.processMessage('Hello');
      controller.clearConversation();
      
      const summary = controller.getConversationSummary();
      expect(summary.messageCount).toBe(0);
      
      const stats = controller.getStats();
      expect(stats.tools).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear everything', async () => {
      await controller.initialize();
      await controller.processMessage('Hello');
      controller.registerTool({
        definition: {
          name: 'test',
          description: 'Test',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => ({ result: 'success' }),
      });

      controller.reset();
      
      const summary = controller.getConversationSummary();
      expect(summary.messageCount).toBe(0);
      
      const stats = controller.getStats();
      expect(stats.tools).toBe(0);
    });
  });

  describe('getConversationSummary', () => {
    it('should return conversation summary', () => {
      const summary = controller.getConversationSummary();
      expect(summary.id).toBeDefined();
      expect(typeof summary.id).toBe('string');
    });
  });

  describe('searchMemory', () => {
    it('should search memory with query', () => {
      const results = controller.searchMemory('test');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive stats', async () => {
      await controller.initialize();
      const stats = controller.getStats();
      
      expect(stats.conversation).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.tools).toBeDefined();
      expect(stats.models).toBeDefined();
      expect(stats.models.isReady).toBe(true);
      expect(stats.models.conversationModel).toBeDefined();
      expect(stats.models.functionModel).toBeDefined();
    });
  });
});
