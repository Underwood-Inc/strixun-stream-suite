import '@testing-library/jest-dom/vitest';
import * as svelte from 'svelte';

// Patch onDestroy to handle SSR context being null in test environment
// This is a known issue with Svelte 5 + testing-library
const originalOnDestroy = svelte.onDestroy;
Object.defineProperty(svelte, 'onDestroy', {
  value: function(fn: () => void) {
    try {
      return originalOnDestroy(fn);
    } catch (error: any) {
      // If SSR context is null (test environment), store the cleanup function
      // and call it during component cleanup via testing-library's cleanup()
      if (error?.message?.includes('ssr_context') || error?.message?.includes('null') || 
          error?.message?.includes('Cannot read properties of null')) {
        // Store cleanup function to be called during cleanup
        if (typeof window !== 'undefined') {
          if (!(window as any).__svelteCleanupFunctions) {
            (window as any).__svelteCleanupFunctions = [];
          }
          (window as any).__svelteCleanupFunctions.push(fn);
        }
        // Return a no-op unsubscribe function
        return () => {};
      }
      throw error;
    }
  },
  configurable: true,
  writable: true,
});

