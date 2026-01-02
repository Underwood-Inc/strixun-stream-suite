import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Exclude E2E tests - they should only run with Playwright
    exclude: [
      '**/*.e2e.spec.ts', 
      '**/*.e2e.test.ts', 
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
      'node_modules/**',
    ],
  },
});
