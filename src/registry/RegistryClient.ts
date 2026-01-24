import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { MCPServerConfig } from '../config/types/config.js';

const readFileAsync = promisify(fs.readFile);

export interface BuiltinServer {
  id: string;
  name: string;
  description: string;
  package: string;
  version: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  category: string;
  tags: string[];
  homepage?: string;
  repository?: string;
}

export interface RegistryMetadata {
  version: string;
  lastUpdated: string;
  totalServers: number;
}

export interface RegistryData {
  servers: Record<string, BuiltinServer>;
  categories: Record<string, { name: string; description: string }>;
  registry: RegistryMetadata;
}

export class RegistryClient {
  private builtinServersPath: string;
  private cache: RegistryData | null = null;
  private lastCacheTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(configPath?: string) {
    const projectRoot = path.resolve(__dirname, '../../config');
    this.builtinServersPath = path.join(projectRoot, 'builtin-servers.json');
  }

  /**
   * Load builtin servers from configuration file
   */
  async loadBuiltinServers(): Promise<RegistryData> {
    const now = Date.now();
    
    if (this.cache && (now - this.lastCacheTime) < this.CACHE_DURATION) {
      return this.cache;
    }

    try {
      const data = await readFileAsync(this.builtinServersPath, 'utf8');
      const registryData: RegistryData = JSON.parse(data);
      
      this.cache = registryData;
      this.lastCacheTime = now;
      
      return registryData;
    } catch (error) {
      console.error('Failed to load builtin servers:', error);
      throw new Error(`Failed to load builtin servers: ${error}`);
    }
  }

  /**
   * Get server by ID
   */
  async getServer(serverId: string): Promise<BuiltinServer | null> {
    const data = await this.loadBuiltinServers();
    return data.servers[serverId] || null;
  }

  /**
   * List all available servers
   */
  async listServers(): Promise<BuiltinServer[]> {
    const data = await this.loadBuiltinServers();
    return Object.values(data.servers);
  }

  /**
   * Search servers by query
   */
  async searchServers(query: string): Promise<BuiltinServer[]> {
    const data = await this.loadBuiltinServers();
    const lowerQuery = query.toLowerCase();
    
    return Object.values(data.servers).filter(server => 
      server.name.toLowerCase().includes(lowerQuery) ||
      server.description.toLowerCase().includes(lowerQuery) ||
      server.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      server.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get servers by category
   */
  async getServersByCategory(category: string): Promise<BuiltinServer[]> {
    const data = await this.loadBuiltinServers();
    
    return Object.values(data.servers).filter(server => 
      server.category === category
    );
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Record<string, { name: string; description: string }>> {
    const data = await this.loadBuiltinServers();
    return data.categories;
  }

  /**
   * Convert builtin server to MCP config
   */
  async serverToMcpConfig(serverId: string, customEnv?: Record<string, string>): Promise<MCPServerConfig | null> {
    const server = await this.getServer(serverId);
    if (!server) {
      return null;
    }

    const config: MCPServerConfig = {
      name: serverId,
      enabled: false,
      command: server.command,
      args: server.args,
      description: server.description,
      type: 'builtin',
      env: {
        ...server.env,
        ...customEnv
      }
    };

    return config;
  }

  /**
   * Get registry metadata
   */
  async getRegistryMetadata(): Promise<RegistryMetadata> {
    const data = await this.loadBuiltinServers();
    return data.registry;
  }

  /**
   * Validate server ID exists
   */
  async validateServerId(serverId: string): Promise<boolean> {
    const server = await this.getServer(serverId);
    return server !== null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null;
    this.lastCacheTime = 0;
  }

  /**
   * Get popular servers (first few)
   */
  async getPopularServers(limit = 5): Promise<BuiltinServer[]> {
    const servers = await this.listServers();
    return servers.slice(0, limit);
  }

  /**
   * Get servers by tags
   */
  async getServersByTag(tag: string): Promise<BuiltinServer[]> {
    const data = await this.loadBuiltinServers();
    const lowerTag = tag.toLowerCase();
    
    return Object.values(data.servers).filter(server => 
      server.tags.some(serverTag => serverTag.toLowerCase() === lowerTag)
    );
  }
}
