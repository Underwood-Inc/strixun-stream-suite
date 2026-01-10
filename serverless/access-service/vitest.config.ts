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
    testTimeout: 30000, // 30 seconds for integration tests
    pool: 'forks',
    isolate: true,
    passWithNoTests: false, // Fail if no tests found (we have tests now!)
    server: {
      deps: {
        inline: [
          '@strixun/api-framework',
          '@strixun/otp-auth-service',
        ],
      },
    },
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
        '**/worker.ts', // Worker entry point excluded from coverage
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
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@strixun/api-framework': resolve(__dirname, '../../packages/api-framework'),
      '@strixun/otp-auth-service': resolve(__dirname, '../otp-auth-service'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
