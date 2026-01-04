import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest Configuration for Cloudflare Workers
 * 
 * NOTE: @cloudflare/vitest-pool-workers doesn't support Vitest 4.0.16 yet
 * (requires Vitest 2.0.x - 3.2.x). Until it's updated, we use Miniflare directly
 * for all integration tests that need workers.
 * 
 * Single-worker tests can use @cloudflare/vitest-pool-workers once Vitest is downgraded
 * or the package is updated. For now, all integration tests use Miniflare.
 */
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
  },
  test: {
    globals: true,
    environment: 'node', // Use node environment - Miniflare tests run in Node.js
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
    passWithNoTests: true, // Don't fail if no tests are found
    // NOTE: Integration tests using Miniflare don't need globalSetup
    // They create workers directly in beforeAll hooks
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
