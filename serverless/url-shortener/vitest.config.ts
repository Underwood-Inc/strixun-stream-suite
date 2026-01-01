import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.test.{js,ts}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'app/**',
      '**/*.e2e.{test,spec}.{js,ts}',
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
    ],
    testTimeout: 10000,
    pool: 'forks',
    isolate: true,
    passWithNoTests: true,
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
});

