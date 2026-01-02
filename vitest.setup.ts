import { expect, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/svelte/svelte5';
import '@testing-library/jest-dom/vitest';
import * as svelte from 'svelte';

// Patch onDestroy to handle SSR context being null in test environment
// This is a known issue with Svelte 5 + testing-library
// Only patch if not already patched and if svelte is available
// Skip patching if we're in a non-Svelte test environment (e.g., React tests)
(function patchSvelteOnDestroy() {
  if (!svelte || typeof svelte.onDestroy !== 'function') {
    return; // Svelte not available or onDestroy not a function
  }
  
  const originalOnDestroy = svelte.onDestroy;
  // Check if already patched by checking for a marker property
  if ((originalOnDestroy as any).__patched) {
    return; // Already patched
  }
  
  try {
    // Check property descriptor first to see if it's configurable
    const descriptor = Object.getOwnPropertyDescriptor(svelte, 'onDestroy');
    if (descriptor && !descriptor.configurable) {
      // Property is non-configurable, cannot patch - this is fine, skip silently
      // This can happen if the setup file is loaded multiple times or in non-Svelte environments
      return;
    }
    
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
    // Mark as patched
    (svelte.onDestroy as any).__patched = true;
  } catch (error) {
    // If property cannot be redefined (already defined as non-configurable), skip patching
    // This can happen if the setup file is loaded multiple times or in non-Svelte environments
    // Only warn if it's an unexpected error (not a redefinition error)
    if (error instanceof TypeError && error.message.includes('Cannot redefine property')) {
      // Expected error when property is non-configurable - skip silently
      return;
    }
    // Unexpected error - log it (but only in development/debug mode)
    if (process.env.DEBUG || process.env.VITEST_DEBUG) {
      console.warn('[vitest.setup] Could not patch svelte.onDestroy:', error);
    }
  }
})();

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

