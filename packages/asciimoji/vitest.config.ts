import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Exclude E2E tests - they should only run with Playwright
    exclude: ['**/*.e2e.spec.ts', '**/*.e2e.test.ts', 'node_modules/**'],
  },
});
