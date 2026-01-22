import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Memory } from './Memory.js';

describe('Memory', () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory({ maxEntries: 10, enableExpiration: false });
  });

  describe('constructor', () => {
    it('should create empty memory', () => {
      expect(memory.count()).toBe(0);
    });

    it('should set default maxEntries to 1000', () => {
      const mem = new Memory();
      expect(mem['maxEntries']).toBe(1000);
    });
  });

  describe('add', () => {
    it('should add memory entry with auto-generated ID', () => {
      const id = memory.add({
        type: 'fact',
        content: 'Hello world',
        tags: ['greeting'],
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(memory.count()).toBe(1);
    });

    it('should add memory with expiration', () => {
      const mem = new Memory({ enableExpiration: true, defaultTtl: 1000 });
      mem.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      const entries = mem.getAll();
      expect(entries[0].expiresAt).toBeDefined();
      expect(entries[0].expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should trim entries when exceeding max', () => {
      const smallMem = new Memory({ maxEntries: 3 });
      for (let i = 0; i < 5; i++) {
        smallMem.add({
          type: 'fact',
          content: `Entry ${i}`,
          tags: [],
        });
      }
      expect(smallMem.count()).toBe(3);
    });

    it('should index tags', () => {
      memory.add({
        type: 'fact',
        content: 'Test',
        tags: ['tag1', 'tag2'],
      });

      const tag1Entries = memory.getByTag('tag1');
      expect(tag1Entries).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('should return entry by ID', () => {
      const id = memory.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      const entry = memory.get(id);
      expect(entry).toBeDefined();
      expect(entry?.content).toBe('Test');
    });

    it('should return undefined for non-existent ID', () => {
      const entry = memory.get('non-existent');
      expect(entry).toBeUndefined();
    });

    it('should return undefined for expired entry', () => {
      const mem = new Memory({ enableExpiration: true, defaultTtl: -1000 });
      const id = mem.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      const entry = mem.get(id);
      expect(entry).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update existing entry', () => {
      const id = memory.add({
        type: 'fact',
        content: 'Original',
        tags: [],
      });

      const success = memory.update(id, { content: 'Updated' });
      expect(success).toBe(true);

      const entry = memory.get(id);
      expect(entry?.content).toBe('Updated');
    });

    it('should return false for non-existent ID', () => {
      const success = memory.update('non-existent', { content: 'Updated' });
      expect(success).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete entry', () => {
      const id = memory.add({
        type: 'fact',
        content: 'Test',
        tags: ['tag1'],
      });

      const success = memory.delete(id);
      expect(success).toBe(true);
      expect(memory.count()).toBe(0);
      expect(memory.getByTag('tag1')).toHaveLength(0);
    });

    it('should return false for non-existent ID', () => {
      const success = memory.delete('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      memory.clear();
      memory.add({ type: 'fact', content: 'JavaScript is a programming language', tags: ['code', 'js'] });
      memory.add({ type: 'preference', content: 'I prefer dark mode', tags: ['ui'] });
      memory.add({ type: 'note', content: 'Remember to buy groceries', tags: ['todo'] });
    });

    it('should search by query', () => {
      const results = memory.search({ query: 'programming' });
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('programming');
    });

    it('should search by type', () => {
      const results = memory.search({ type: 'preference' });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('preference');
    });

    it('should search by tag', () => {
      const results = memory.search({ tags: ['code'] });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('code');
    });

    it('should apply limit', () => {
      const results = memory.search({ query: 'I', limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getByTag', () => {
    it('should return entries by tag', () => {
      memory.add({
        type: 'fact',
        content: 'Entry 1',
        tags: ['common'],
      });
      memory.add({
        type: 'fact',
        content: 'Entry 2',
        tags: ['common'],
      });
      memory.add({
        type: 'fact',
        content: 'Entry 3',
        tags: ['unique'],
      });

      const results = memory.getByTag('common');
      expect(results).toHaveLength(2);
    });
  });

  describe('getAll', () => {
    it('should return all non-expired entries', () => {
      memory.add({
        type: 'fact',
        content: 'Test 1',
        tags: [],
      });
      memory.add({
        type: 'fact',
        content: 'Test 2',
        tags: [],
      });

      const entries = memory.getAll();
      expect(entries).toHaveLength(2);
    });

    it('should exclude expired entries', () => {
      const mem = new Memory({ enableExpiration: true, defaultTtl: -1000 });
      mem.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      const entries = mem.getAll();
      expect(entries).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      memory.add({
        type: 'fact',
        content: 'Test',
        tags: ['tag1'],
      });
      memory.add({
        type: 'preference',
        content: 'Test',
        tags: ['tag2'],
      });

      const stats = memory.getStats();
      expect(stats.total).toBe(2);
      expect(stats.byType['fact']).toBe(1);
      expect(stats.byType['preference']).toBe(1);
      expect(stats.byTag['tag1']).toBe(1);
      expect(stats.byTag['tag2']).toBe(1);
    });
  });

  describe('clearExpired', () => {
    it('should clear expired entries', () => {
      const mem = new Memory({ enableExpiration: true, defaultTtl: -1000 });
      mem.add({
        type: 'fact',
        content: 'Expired',
        tags: [],
      });
      mem.add({
        type: 'fact',
        content: 'Not expired',
        tags: [],
      });
      // Mock one as not expired
      const all = mem.getAll();
      (all[1] as any).expiresAt = new Date(Date.now() + 100000);

      const cleared = mem.clearExpired();
      expect(cleared).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      memory.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      memory.clear();
      expect(memory.count()).toBe(0);
    });
  });

  describe('importFromJSON', () => {
    it('should import entries from JSON', () => {
      const json = JSON.stringify([
        { id: '1', type: 'fact', content: 'Imported 1', tags: [], createdAt: new Date() },
        { id: '2', type: 'fact', content: 'Imported 2', tags: [], createdAt: new Date() },
      ]);

      const imported = memory.importFromJSON(json);
      expect(imported).toBe(2);
    });

    it('should handle invalid JSON', () => {
      const imported = memory.importFromJSON('invalid json');
      expect(imported).toBe(0);
    });
  });

  describe('exportToJSON', () => {
    it('should export entries to JSON', () => {
      memory.add({
        type: 'fact',
        content: 'Test',
        tags: [],
      });

      const json = memory.exportToJSON();
      const entries = JSON.parse(json);
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe('Test');
    });
  });
});
