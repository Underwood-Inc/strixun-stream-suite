/**
 * Enhanced API Framework - KV Cache Adapter
 * 
 * Cloudflare KV-based caching for Workers
 */

import type { RequestContext } from '../types';

export interface KVCacheOptions {
  namespace: KVNamespace;
  defaultTTL?: number;
  keyPrefix?: string;
}

/**
 * KV Cache Adapter
 */
export class KVCache {
  private namespace: KVNamespace;
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(options: KVCacheOptions) {
    this.namespace = options.namespace;
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
    this.keyPrefix = options.keyPrefix || 'api:cache:';
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.namespace.get(this.prefixKey(key), { type: 'json' });
      return value as T | null;
    } catch (error) {
      console.error('KV cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl || this.defaultTTL;
      await this.namespace.put(
        this.prefixKey(key),
        JSON.stringify(value),
        { expirationTtl: ttlSeconds }
      );
    } catch (error) {
      console.error('KV cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.namespace.delete(this.prefixKey(key));
    } catch (error) {
      console.error('KV cache delete error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Clear all cache entries (by prefix)
   * 
   * Note: KV doesn't support listing keys, so this is a no-op
   * In practice, you'd need to track keys separately or use a different strategy
   */
  async clear(): Promise<void> {
    // KV doesn't support listing keys, so we can't clear all
    // This would require maintaining a separate key index
    console.warn('KV cache clear() is not supported - KV does not support listing keys');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; hitRate?: number }> {
    // KV doesn't provide statistics
    return { size: 0 };
  }

  /**
   * Prefix cache key
   */
  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}

/**
 * Create KV cache from context
 */
export function createKVCache(context: RequestContext, options?: Partial<KVCacheOptions>): KVCache | null {
  if (!context.env?.CACHE_KV) {
    return null;
  }

  return new KVCache({
    namespace: context.env.CACHE_KV,
    ...options,
  });
}

