import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.test.{js,ts}',
      '../shared/**/*.test.{js,ts}', // Include shared tests
    ],
    exclude: [
      'node_modules', 
      'dist', 
      '**/*.e2e.{test,spec}.{js,ts}',
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
    ],
    testTimeout: 10000,
    pool: 'forks',
    isolate: true,
    passWithNoTests: true, // Don't fail if no tests are found
    // Auto-start workers for integration tests (shared setup detects *.integration.test.ts files)
    globalSetup: '../shared/vitest.setup.integration.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/worker.ts',
        '**/router.ts',
        '**/router/**',
        '**/handlers/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
});

