import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        generate: 'dom',
        hydratable: false,
      },
    }),
    react(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, './vitest.setup.ts')],
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/.{idea,git,cache,output,temp}/**',
      '**/svelte/**/*.test.ts', // Skip Svelte component tests for now
      '**/react/**/*.test.tsx', // Skip React component tests for now
      'node_modules/**', // Exclude all node_modules tests
      '**/*.e2e.{test,spec}.{js,ts,tsx}', // Exclude e2e tests (run with Playwright)
    ],
  },
  resolve: {
    alias: {
      '@shared-components': resolve(__dirname, '..'),
    },
  },
});

