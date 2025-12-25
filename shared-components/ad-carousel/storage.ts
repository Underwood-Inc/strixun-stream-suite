/**
 * Simple Storage Adapter for AdCarousel
 * 
 * Provides a simple interface for storing/retrieving carousel state.
 * Can use localStorage directly or accept a custom storage adapter.
 */

export interface StorageAdapter {
  get(key: string): unknown | null;
  set(key: string, value: unknown): void;
}

/**
 * Default localStorage-based storage adapter
 */
export const localStorageAdapter: StorageAdapter = {
  get(key: string): unknown | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return null;
      return JSON.parse(item);
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[AdCarousel] Failed to save state:', error);
    }
  }
};

