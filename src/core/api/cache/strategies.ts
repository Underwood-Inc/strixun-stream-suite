/**
 * API Framework - Cache Strategies
 * 
 * Different caching strategies implementation
 */

import type { APIRequest, APIResponse, CacheConfig } from '../types';
import { MemoryCache } from './memory';
import { IndexedDBCache } from './indexeddb';

export class CacheManager {
  private memoryCache: MemoryCache;
  private indexedDBCache: IndexedDBCache;
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.memoryCache = new MemoryCache();
    this.indexedDBCache = new IndexedDBCache();
  }

  /**
   * Generate cache key from request
   */
  private getCacheKey(request: APIRequest, config?: CacheConfig): string {
    if (config?.key) {
      return config.key;
    }

    const parts = [
      request.method,
      request.path || request.url,
      JSON.stringify(request.params || {}),
    ];

    return parts.join('|');
  }

  /**
   * Get from cache
   */
  async get<T = unknown>(
    request: APIRequest,
    config?: CacheConfig
  ): Promise<APIResponse<T> | null> {
    if (!this.enabled || !config) {
      return null;
    }

    const key = this.getCacheKey(request, config);
    
    // Try memory cache first
    const memoryEntry = this.memoryCache.get<APIResponse<T>>(key);
    if (memoryEntry) {
      return { ...memoryEntry.data, cached: true };
    }

    // Try IndexedDB cache
    const dbEntry = await this.indexedDBCache.get<APIResponse<T>>(key);
    if (dbEntry) {
      // Also store in memory for faster access
      this.memoryCache.set(key, dbEntry.data, config);
      return { ...dbEntry.data, cached: true };
    }

    return null;
  }

  /**
   * Set in cache
   */
  async set<T = unknown>(
    request: APIRequest,
    response: APIResponse<T>,
    config?: CacheConfig
  ): Promise<void> {
    if (!this.enabled || !config) {
      return;
    }

    const key = this.getCacheKey(request, config);

    // Store in both caches
    this.memoryCache.set(key, response, config);
    await this.indexedDBCache.set(key, response, config);
  }

  /**
   * Invalidate cache
   */
  async invalidate(request: APIRequest, config?: CacheConfig): Promise<void> {
    const key = this.getCacheKey(request, config);
    this.memoryCache.delete(key);
    await this.indexedDBCache.delete(key);
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const memoryCount = this.memoryCache.invalidateByTags(tags);
    const dbCount = await this.indexedDBCache.invalidateByTags(tags);
    return memoryCount + dbCount;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.indexedDBCache.clear();
  }

  /**
   * Execute with cache strategy
   */
  async execute<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>,
    config?: CacheConfig
  ): Promise<APIResponse<T>> {
    if (!this.enabled || !config) {
      return executor();
    }

    const strategy = config.strategy || 'network-first';
    const cached = await this.get<T>(request, config);

    switch (strategy) {
      case 'cache-first':
        if (cached) {
          return cached;
        }
        const response1 = await executor();
        await this.set(request, response1, config);
        return response1;

      case 'network-first':
        try {
          const response2 = await executor();
          await this.set(request, response2, config);
          return response2;
        } catch (error) {
          if (cached) {
            return cached;
          }
          throw error;
        }

      case 'stale-while-revalidate':
        if (cached) {
          // Return cached immediately, fetch fresh in background
          executor()
            .then((response) => this.set(request, response, config))
            .catch(() => {
              // Ignore errors in background fetch
            });
          return cached;
        }
        const response3 = await executor();
        await this.set(request, response3, config);
        return response3;

      case 'cache-only':
        if (cached) {
          return cached;
        }
        throw new Error('Cache miss and cache-only strategy');

      case 'network-only':
        const response4 = await executor();
        await this.set(request, response4, config);
        return response4;

      default:
        return executor();
    }
  }
}


