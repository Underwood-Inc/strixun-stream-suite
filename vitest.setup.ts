import { expect, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/svelte/svelte5';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
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

