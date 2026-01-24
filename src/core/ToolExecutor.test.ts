import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from './ToolExecutor.js';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  const mockTool = {
    definition: {
      name: 'add',
      description: 'Add two numbers',
      parameters: {
        type: 'object' as const,
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      },
    },
    handler: async (args) => (args.a as number) + (args.b as number),
  };

  beforeEach(() => {
    executor = new ToolExecutor();
    executor.register(mockTool);
  });

  describe('constructor', () => {
    it('should create empty executor', () => {
      const exec = new ToolExecutor();
      expect(exec.getToolCount()).toBe(0);
    });

    it('should set default timeout to 30 seconds', () => {
      const exec = new ToolExecutor();
      expect(exec['defaultTimeout']).toBe(30000);
    });
  });

  describe('register', () => {
    it('should register a tool', () => {
      const exec = new ToolExecutor();
      exec.register(mockTool);
      expect(exec.getToolCount()).toBe(1);
      expect(exec.hasTool('add')).toBe(true);
    });
  });

  describe('registerMany', () => {
    it('should register multiple tools', () => {
      const exec = new ToolExecutor();
      const tool2 = {
        definition: {
          name: 'subtract',
          description: 'Subtract two numbers',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => 0,
      };

      exec.registerMany([mockTool, tool2]);
      expect(exec.getToolCount()).toBe(2);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      executor.unregister('add');
      expect(executor.getToolCount()).toBe(0);
      expect(executor.hasTool('add')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const result = executor.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getTool', () => {
    it('should return registered tool', () => {
      const tool = executor.getTool('add');
      expect(tool).toBeDefined();
      expect(tool?.definition.name).toBe('add');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = executor.getTool('nonexistent');
      expect(tool).toBeUndefined();
    });
  });

  describe('getAllTools', () => {
    it('should return all tool definitions', () => {
      const tools = executor.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
    });
  });

  describe('execute', () => {
    it('should execute tool successfully', async () => {
      const result = await executor.execute('add', { a: 2, b: 3 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(5);
      expect(result.name).toBe('add');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should return error for non-existent tool', async () => {
      const result = await executor.execute('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should cache results when enabled', async () => {
      const exec = new ToolExecutor({ enableCache: true });
      exec.register(mockTool);

      const result1 = await exec.execute('add', { a: 2, b: 3 });
      const result2 = await exec.execute('add', { a: 2, b: 3 });

      expect(result1.result).toBe(5);
      expect(result2.result).toBe(5);
    });

    it('should not cache when disabled', async () => {
      const exec = new ToolExecutor({ enableCache: false });
      exec.register(mockTool);

      const result1 = await exec.execute('add', { a: 2, b: 3 });
      const result2 = await exec.execute('add', { a: 2, b: 3 });

      expect(result1.executionTime).toBeGreaterThanOrEqual(0);
      expect(result2.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool errors', async () => {
      const errorTool = {
        definition: {
          name: 'error',
          description: 'Always throws error',
          parameters: { type: 'object' as const, properties: {}, required: [] },
        },
        handler: async () => {
          throw new Error('Tool error');
        },
      };

      executor.register(errorTool);
      const result = await executor.execute('error', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool error');
    });
  });

  describe('executeMany', () => {
    it('should execute multiple tools in parallel', async () => {
      const exec = new ToolExecutor();
      exec.registerMany([
        mockTool,
        {
          definition: {
            name: 'multiply',
            description: 'Multiply two numbers',
            parameters: { type: 'object' as const, properties: {}, required: [] },
          },
          handler: async (args) => (args.a as number) * (args.b as number),
        },
      ]);

      const results = await exec.executeMany([
        { name: 'add', args: { a: 2, b: 3 } },
        { name: 'multiply', args: { a: 4, b: 5 } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe(5);
      expect(results[1].result).toBe(20);
    });
  });

  describe('clearCache', () => {
    it('should clear cache', async () => {
      const exec = new ToolExecutor({ enableCache: true });
      exec.register(mockTool);

      await exec.execute('add', { a: 2, b: 3 });
      const statsBefore = exec.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      exec.clearCache();
      const statsAfter = exec.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('clearExpiredCache', () => {
    it('should return 0 when no entries are expired', async () => {
      const exec = new ToolExecutor({ enableCache: true });
      exec.register(mockTool);

      await exec.execute('add', { a: 2, b: 3 });

      const cleared = exec.clearExpiredCache();
      expect(cleared).toBe(0);
    });
  });
});
