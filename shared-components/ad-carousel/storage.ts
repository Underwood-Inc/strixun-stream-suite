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
 * 
 * CRITICAL: Wrapped in try-catch to prevent browser lockup if localStorage is corrupted
 * Note: We can't add true timeout protection to synchronous localStorage operations,
 * but we can catch errors and fail gracefully.
 */
export const localStorageAdapter: StorageAdapter = {
  get(key: string): unknown | null {
    try {
      // Test localStorage availability first (some browsers disable it)
      if (typeof localStorage === 'undefined' || !localStorage) {
        return null;
      }
      
      // Wrap in try-catch - if localStorage is corrupted, getItem can throw or hang
      // Unfortunately we can't timeout synchronous operations, but we can catch errors
      let item: string | null = null;
      try {
        item = localStorage.getItem(key);
      } catch (e) {
        // localStorage.getItem threw an error (corrupted storage or quota exceeded)
        console.warn('[AdCarousel] localStorage.getItem failed:', e);
        return null;
      }
      
      if (item === null) return null;
      
      // JSON.parse can throw for malformed JSON
      try {
        return JSON.parse(item);
      } catch (e) {
        console.warn('[AdCarousel] JSON.parse failed for key:', key, e);
        return null;
      }
    } catch (error) {
      // Catch any other unexpected errors
      console.warn('[AdCarousel] Storage get error:', error);
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      // Test localStorage availability first
      if (typeof localStorage === 'undefined' || !localStorage) {
        return;
      }
      
      // Wrap in try-catch - setItem can throw if quota exceeded or storage is corrupted
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
      } catch (error) {
        // Common errors: QuotaExceededError, SecurityError (private browsing)
        console.warn('[AdCarousel] Failed to save state:', error);
      }
    } catch (error) {
      // Catch any other unexpected errors
      console.warn('[AdCarousel] Storage set error:', error);
    }
  }
};

