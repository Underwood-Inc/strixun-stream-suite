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
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
