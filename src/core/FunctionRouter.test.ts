import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRouter } from './FunctionRouter.js';

describe('FunctionRouter', () => {
  let router: FunctionRouter;
  const mockTools = [
    {
      name: 'search',
      description: 'Search the web',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'calculate',
      description: 'Calculate something',
      parameters: { type: 'object' as const, properties: {}, required: [] },
    },
  ];

  beforeEach(() => {
    router = new FunctionRouter();
    router.registerTools(mockTools);
  });

  describe('constructor', () => {
    it('should create empty router', () => {
      const r = new FunctionRouter();
      expect(r.getToolDefinitions()).toHaveLength(0);
    });

    it('should set default maxCallsPerTurn to 5', () => {
      const r = new FunctionRouter();
      expect(r['maxCallsPerTurn']).toBe(5);
    });
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const r = new FunctionRouter();
      r.registerTool(mockTools[0]);
      expect(r.getToolDefinitions()).toHaveLength(1);
    });

    it('should check if tool exists', () => {
      expect(router.hasTool('search')).toBe(true);
      expect(router.hasTool('nonexistent')).toBe(false);
    });
  });

  describe('registerTools', () => {
    it('should register multiple tools', () => {
      const r = new FunctionRouter();
      r.registerTools(mockTools);
      expect(r.getToolDefinitions()).toHaveLength(2);
    });
  });

  describe('route', () => {
    it('should route to function model when forceTool is true', async () => {
      const result = await router.route({
        tools: mockTools,
        messages: [{ role: 'user', content: 'Hello' }],
        forceTool: true,
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('model_call');
      expect(result.useConversationModel).toBe(false);
    });

    it('should route to function model when tool is mentioned', async () => {
      const result = await router.route({
        tools: mockTools,
        messages: [{ role: 'user', content: 'Please search for something' }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.useConversationModel).toBe(false);
    });

    it('should route to conversation model by default', async () => {
      const result = await router.route({
        tools: mockTools,
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
      });

      expect(result.toolCalls).toHaveLength(0);
      expect(result.useConversationModel).toBe(true);
    });

    it('should route to function model when tool keyword is used', async () => {
      const result = await router.route({
        tools: mockTools,
        messages: [{ role: 'user', content: 'Can you find something?' }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.useConversationModel).toBe(false);
    });
  });

  describe('processModelResponse', () => {
    it('should parse tool calls from model response', () => {
      const response = {
        toolCalls: [
          { name: 'search', arguments: '{"query": "test"}' },
          { name: 'calculate', arguments: '{"a": 1, "b": 2}' },
        ],
      };

      const result = router.processModelResponse(response);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0].name).toBe('search');
      expect(result.calls[0].args).toEqual({ query: 'test' });
    });

    it('should handle invalid JSON', () => {
      const response = {
        toolCalls: [
          { name: 'search', arguments: 'invalid json' },
        ],
      };

      const result = router.processModelResponse(response);
      expect(result.calls).toHaveLength(0);
    });
  });

  describe('formatToolResults', () => {
    it('should format successful tool results', () => {
      const results = [
        {
          id: '1',
          name: 'search',
          args: {},
          result: 'Found 5 results',
          success: true,
          executionTime: 100,
        },
        {
          id: '2',
          name: 'calculate',
          args: {},
          result: 42,
          success: true,
          executionTime: 50,
        },
      ];

      const formatted = router.formatToolResults(results);
      expect(formatted).toContain('search: "Found 5 results"');
      expect(formatted).toContain('calculate: 42');
    });

    it('should format tool errors', () => {
      const results = [
        {
          id: '1',
          name: 'search',
          args: {},
          result: null,
          success: false,
          error: 'Network error',
          executionTime: 100,
        },
      ];

      const formatted = router.formatToolResults(results);
      expect(formatted).toContain('search: Error - Network error');
    });

    it('should return message for empty results', () => {
      const formatted = router.formatToolResults([]);
      expect(formatted).toBe('No tools were executed.');
    });
  });

  describe('clearTools', () => {
    it('should clear all tools', () => {
      const r = new FunctionRouter();
      r.registerTools(mockTools);
      expect(r.getToolDefinitions()).toHaveLength(2);

      r.clearTools();
      expect(r.getToolDefinitions()).toHaveLength(0);
    });
  });
});
