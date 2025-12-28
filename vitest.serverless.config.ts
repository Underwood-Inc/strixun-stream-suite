import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // NO Svelte plugin - this is for serverless/Node.js tests only
  test: {
    globals: true,
    environment: 'node', // Node environment for CompressionStream support
    include: ['serverless/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.storybook', 'src/**'],
    testTimeout: 10000, // 10 second timeout per test (reduced from 30s to catch hangs faster)
    hookTimeout: 10000, // 10 second timeout for hooks
    teardownTimeout: 5000, // 5 second timeout for teardown
    pool: 'forks', // Use forks instead of threads to avoid memory issues
    poolOptions: {
      forks: {
        singleFork: false, // Allow multiple forks for parallel execution
      },
    },
    isolate: true, // Isolate each test file
    maxConcurrency: 1, // Run tests sequentially to avoid conflicts
  },
  resolve: {
    alias: {
      '@strixun/api-framework': resolve(__dirname, './serverless/shared'),
    },
  },
});

