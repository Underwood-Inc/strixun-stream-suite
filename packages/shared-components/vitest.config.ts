import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    svelte({ hot: false }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'react/**/*.test.{ts,tsx}',
      'svelte/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'storybook-static',
      '**/*.stories.{ts,tsx,svelte}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'storybook-static/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx,svelte}',
        'vitest.setup.ts',
      ],
      include: [
        'react/**/*.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
