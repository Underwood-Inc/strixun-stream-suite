import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/*.{test,spec}.{js,ts}',
      '../shared/**/*.{test,spec}.{js,ts}', // Include shared encryption tests
    ],
    exclude: ['node_modules', 'dist', 'dashboard'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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

