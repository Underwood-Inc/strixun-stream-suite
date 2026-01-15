import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{js,ts}'],
    exclude: [
      'node_modules', 
      'dist', 
      '**/*.e2e.{test,spec}.{js,ts}',
      '**/*.spec.{js,ts}',
    ],
    testTimeout: 10000,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'core/**/*.ts',
        'adapters/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/**',
        'node_modules/**',
      ],
      // all: true, // Removed - not supported in coverage v8
      lines: 90,
      functions: 90,
      branches: 80,
      statements: 90,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
