import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.{test,spec}.{js,ts}',
      '../shared/**/*.{test,spec}.{js,ts}', // Include shared tests
    ],
    exclude: ['node_modules', 'dist', '**/*.e2e.{test,spec}.{js,ts}'],
    testTimeout: 10000,
    pool: 'forks',
    isolate: true,
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

