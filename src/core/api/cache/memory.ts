/**
 * API Framework - Memory Cache
 * 
 * In-memory cache implementation
 */

import type { CacheEntry, CacheConfig } from '../types';

export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Get entry from cache
   */
  get<T = unknown>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Check TTL
    if (now - entry.timestamp > entry.ttl) {
      // Entry is stale but still valid
      return { ...entry, data: entry.data as T };
    }

    return { ...entry, data: entry.data as T };
  }

  /**
   * Set entry in cache
   */
  set<T = unknown>(
    key: string,
    data: T,
    config: CacheConfig
  ): void {
    // Evict if at max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl || 5 * 60 * 1000, // Default 5 minutes
      maxAge: config.maxAge || 10 * 60 * 1000, // Default 10 minutes
      tags: config.tags,
    };

    this.cache.set(key, entry as CacheEntry);
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalidate by tags
   */
  invalidateByTags(tags: string[]): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

