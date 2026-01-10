import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@strixun/api-framework/jwt',
        replacement: resolve(__dirname, '../../packages/api-framework/jwt.ts'),
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
    // Allow .js imports to resolve to .ts files (ES module TypeScript pattern)
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs', '.json'],
  },
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
    testTimeout: 30000, // 30 seconds for integration tests
    passWithNoTests: false, // Fail if no tests found
    fileParallelism: false, // Run test files one at a time (avoid port conflicts)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: [
        'utils/**/*.ts',
        'handlers/**/*.ts',
        'router/**/*.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts}',
        '**/worker.ts',
        '**/types/**',
        '**/scripts/**',
        '**/migrations/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
