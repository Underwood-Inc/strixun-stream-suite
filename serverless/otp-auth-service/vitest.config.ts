import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.{test,spec}.{js,ts}',
      '../shared/**/*.{test,spec}.{js,ts}', // Include shared encryption tests
    ],
    exclude: ['node_modules', 'dist', 'dashboard', '**/*.e2e.{test,spec}.{js,ts}'],
    testTimeout: 10000, // 10 second timeout per test
    pool: 'forks', // Use forks to avoid memory issues
    isolate: true, // Isolate each test file
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

