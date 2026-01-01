import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@strixun/customer-lookup',
        replacement: resolve(__dirname, '../../packages/customer-lookup/index.ts'),
      },
      {
        find: '@strixun/api-framework/enhanced',
        replacement: resolve(__dirname, '../../packages/api-framework/enhanced.ts'),
      },
      {
        find: '@strixun/api-framework/client',
        replacement: resolve(__dirname, '../../packages/api-framework/src/client.ts'),
      },
      {
        find: '@strixun/api-framework',
        replacement: resolve(__dirname, '../../packages/api-framework/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.test.{js,ts}',
      '../shared/**/*.test.{js,ts}', // Include shared encryption tests
    ],
    exclude: [
      'node_modules', 
      'dist', 
      'dashboard', 
      '**/*.e2e.{test,spec}.{js,ts}',
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
    ],
    testTimeout: 10000, // 10 second timeout per test
    pool: 'forks', // Use forks to avoid memory issues
    isolate: true, // Isolate each test file
    passWithNoTests: true, // Don't fail if no tests are found
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'dashboard/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/worker.ts',
        '**/router.ts',
        '**/router/**',
        '**/handlers/**',
        '**/scripts/**',
      ],
    },
  },
});

