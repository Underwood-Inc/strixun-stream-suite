import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ 
    hot: !process.env.VITEST,
    compilerOptions: {
      // Disable SSR for tests to avoid context issues
      generate: 'dom'
    }
  })],
  test: {
    globals: true,
    environment: 'jsdom', // Default for Svelte components
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'], // Only src tests here
    exclude: ['node_modules', 'dist', '.storybook', 'serverless/**'], // Exclude serverless
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.svelte',
        '**/stories/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/lib/components'),
      '@modules': resolve(__dirname, './src/modules'),
      '@stores': resolve(__dirname, './src/stores'),
      '@styles': resolve(__dirname, './src/styles'),
      '@shared-components': resolve(__dirname, './shared-components'),
      '@shared-styles': resolve(__dirname, './shared-styles')
    }
  },
});

