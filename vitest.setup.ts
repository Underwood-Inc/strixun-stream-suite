import { expect, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/svelte/svelte5';
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
  writable: true,
  configurable: true
});

// Cleanup after each test
afterEach(() => {
  // Call any stored cleanup functions before cleanup
  if (typeof window !== 'undefined' && (window as any).__svelteCleanupFunctions) {
    const cleanupFunctions = (window as any).__svelteCleanupFunctions;
    (window as any).__svelteCleanupFunctions = [];
    cleanupFunctions.forEach((fn: () => void) => {
      try {
        fn();
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  }
  cleanup();
});

// Setup DOM before each test - use REAL modules, no mocks
beforeEach(async () => {
  // Initialize real storage module - it needs to be ready for components
  // Import and initialize storage so it's available
  try {
    const { initIndexedDB } = await import('./src/modules/storage');
    // Initialize storage if not already initialized
    if (typeof window !== 'undefined' && !(window as any).__storageInitialized) {
      await initIndexedDB();
      (window as any).__storageInitialized = true;
    }
  } catch (err) {
    // Storage init might fail in test env, that's okay - component should handle it
  }
  
  // Mock window.addLogEntry only as a no-op default
  // Tests can override this to use real store if needed
  if (typeof window !== 'undefined') {
    (window as any).addLogEntry = () => {};
    (window as any).clearLogEntries = () => {};
  }
});

