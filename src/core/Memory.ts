/**
 * Memory Manager
 * Manages long-term memory storage and retrieval
 */

/**
 * Memory entry types
 */
export type MemoryType = 'conversation' | 'fact' | 'preference' | 'note';

/**
 * Memory entry
 */
export interface MemoryEntry {
  /** Unique ID */
  id: string;
  /** Type of memory */
  type: MemoryType;
  /** Content/value */
  content: string;
  /** Tags for searching */
  tags: string[];
  /** Timestamp when created */
  createdAt: Date;
  /** Optional expiration date */
  expiresAt?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search options
 */
export interface MemorySearchOptions {
  /** Search query */
  query: string;
  /** Filter by type */
  type?: MemoryType;
  /** Filter by tags */
  tags?: string[];
  /** Limit results */
  limit?: number;
}

/**
 * Memory storage options
 */
export interface MemoryOptions {
  /** Maximum memory entries */
  maxEntries?: number;
  /** Enable expiration */
  enableExpiration?: boolean;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
}

/**
 * Memory manager for long-term storage
 * Simple in-memory implementation (can be extended with file/DB storage)
 */
export class Memory {
  private entries: Map<string, MemoryEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private maxEntries: number;
  private enableExpiration: boolean;
  private defaultTtl: number;

  constructor(options: MemoryOptions = {}) {
    this.maxEntries = options.maxEntries || 1000;
    this.enableExpiration = options.enableExpiration ?? false;
    this.defaultTtl = options.defaultTtl || 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Add a memory entry
   */
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const expiresAt = entry.expiresAt || (this.enableExpiration ? new Date(now.getTime() + this.defaultTtl) : undefined);
    
    const memoryEntry: MemoryEntry = {
      id,
      ...entry,
      createdAt: now,
      expiresAt,
    };

    this.entries.set(id, memoryEntry);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(id);
    }

    this.trimEntries();
    return id;
  }

  /**
   * Get a memory entry by ID
   */
  get(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.delete(id);
      return undefined;
    }

    return entry;
  }

  /**
   * Update a memory entry
   */
  update(id: string, updates: Partial<MemoryEntry>): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    const updated: MemoryEntry = {
      ...entry,
      ...updates,
    };

    this.entries.set(id, updated);
    return true;
  }

  /**
   * Delete a memory entry
   */
  delete(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(id);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    this.entries.delete(id);
    return true;
  }

  /**
   * Search memory entries
   */
  search(options: MemorySearchOptions): MemoryEntry[] {
    const { query, type, tags, limit } = options;
    const results: MemoryEntry[] = [];

    for (const entry of this.entries.values()) {
      // Skip expired entries
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        continue;
      }

      // Filter by type
      if (type && entry.type !== type) {
        continue;
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        const hasAllTags = tags.every((tag) => entry.tags.includes(tag));
        if (!hasAllTags) {
          continue;
        }
      }

      // Filter by query
      if (query) {
        const queryLower = query.toLowerCase();
        const contentMatch = entry.content.toLowerCase().includes(queryLower);
        const tagsMatch = entry.tags.some((tag) => tag.toLowerCase().includes(queryLower));
        if (!contentMatch && !tagsMatch) {
          continue;
        }
      }

      results.push(entry);

      // Apply limit
      if (limit && results.length >= limit) {
        break;
      }
    }

    return results;
  }

  /**
   * Get entries by tag
   */
  getByTag(tag: string): MemoryEntry[] {
    const entryIds = this.tagIndex.get(tag);
    if (!entryIds) return [];

    const results: MemoryEntry[] = [];
    for (const id of entryIds) {
      const entry = this.get(id);
      if (entry) {
        results.push(entry);
      }
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all entries
   */
  getAll(): MemoryEntry[] {
    const results: MemoryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        continue;
      }
      results.push(entry);
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all tags
   */
  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys()).sort();
  }

  /**
   * Get entry count
   */
  count(): number {
    return this.entries.size;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byTag: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    for (const entry of this.entries.values()) {
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        continue;
      }
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      for (const tag of entry.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return {
      total: this.entries.size,
      byType,
      byTag,
    };
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): number {
    const now = new Date();
    const expiredIds: string[] = [];

    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.delete(id);
    }

    return expiredIds.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.tagIndex.clear();
  }

  /**
   * Trim entries to max count (oldest first)
   */
  private trimEntries(): void {
    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const sorted = Array.from(this.entries.entries()).sort(
      (a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime()
    );

    const removeCount = this.entries.size - this.maxEntries;
    for (let i = 0; i < removeCount; i++) {
      this.delete(sorted[i][0]);
    }
  }

  /**
   * Import entries from JSON
   */
  importFromJSON(json: string): number {
    try {
      const entries = JSON.parse(json) as MemoryEntry[];
      let imported = 0;

      for (const entry of entries) {
        const { id, createdAt, expiresAt, ...rest } = entry;
        this.add(rest);
        imported++;
      }

      return imported;
    } catch {
      return 0;
    }
  }

  /**
   * Export entries to JSON
   */
  exportToJSON(): string {
    const entries = this.getAll();
    return JSON.stringify(entries, null, 2);
  }
}
