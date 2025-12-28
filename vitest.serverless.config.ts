import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // NO Svelte plugin - this is for serverless/Node.js tests only
  test: {
    globals: true,
    environment: 'node', // Node environment for CompressionStream support
    include: ['serverless/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.storybook', 'src/**'],
    testTimeout: 30000,
    pool: 'forks', // Use forks instead of threads to avoid memory issues
    isolate: true, // Isolate each test file
  },
  resolve: {
    alias: {
      '@strixun/api-framework': resolve(__dirname, './serverless/shared'),
    },
  },
});

