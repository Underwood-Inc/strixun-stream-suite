import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // NO Svelte plugin - this is for serverless/Node.js tests only
  test: {
    globals: true,
    environment: 'node', // Node environment for CompressionStream support
    include: ['serverless/**/*.test.{js,ts}'],
    exclude: [
      'node_modules', 
      'dist', 
      '.storybook', 
      'src/**',
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
      '**/*.e2e.{test,spec}.{js,ts}', // Exclude Playwright e2e tests
    ],
    testTimeout: 10000, // 10 second timeout per test (reduced from 30s to catch hangs faster)
    hookTimeout: 10000, // 10 second timeout for hooks
    teardownTimeout: 5000, // 5 second timeout for teardown
    pool: 'forks', // Use forks instead of threads to avoid memory issues
    isolate: true, // Isolate each test file
    maxConcurrency: 1, // Run tests sequentially to avoid conflicts
    maxWorkers: 1, // Limit to 1 worker for sequential execution (replaces poolOptions.forks.singleFork)
  },
  resolve: {
    alias: {
      '@strixun/api-framework': resolve(__dirname, './serverless/shared'),
      '@strixun/otp-auth-service': resolve(__dirname, './serverless/otp-auth-service'),
    },
  },
});

