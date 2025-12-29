/**
 * API Framework - IndexedDB Cache
 * 
 * Persistent cache using IndexedDB
 */

import type { CacheEntry, CacheConfig } from '../types';

const DB_NAME = 'strixun_api_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        // IndexedDB not available
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get entry from cache
   */
  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    await this.init();
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error('Failed to get from IndexedDB'));
      };

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > entry.maxAge) {
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(entry);
      };
    });
  }

  /**
   * Set entry in cache
   */
  async set<T = unknown>(
    key: string,
    data: T,
    config: CacheConfig
  ): Promise<void> {
    await this.init();
    if (!this.db) {
      return;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl || 5 * 60 * 1000,
      maxAge: config.maxAge || 10 * 60 * 1000,
      tags: config.tags,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry, key);

      request.onerror = () => {
        reject(new Error('Failed to set in IndexedDB'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    await this.init();
    if (!this.db) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => {
        reject(new Error('Failed to delete from IndexedDB'));
      };

      request.onsuccess = () => {
        resolve(true);
      };
    });
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear IndexedDB'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Invalidate by tags (requires iterating all entries)
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    await this.init();
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      let count = 0;

      request.onerror = () => {
        reject(new Error('Failed to invalidate by tags'));
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };
    });
  }
}


