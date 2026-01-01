import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ 
    hot: !process.env.VITEST,
    compilerOptions: {
      // Disable SSR for tests to avoid context issues
      generate: 'dom',
      hydratable: false
    }
  })],
  test: {
    globals: true,
    environment: 'jsdom', // Default for Svelte components
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true, // Don't fail if no tests are found
    include: [
      'src/**/*.test.{js,ts}',
      'shared-components/**/*.test.{js,ts}', // Include shared-components tests
    ],
    exclude: [
      'node_modules', 
      'dist', 
      '.storybook', 
      'serverless/**',
      'shared-components/otp-login/svelte/**/*.test.ts', // Skip Svelte component tests for now
      'shared-components/otp-login/react/**/*.test.tsx', // Skip React component tests for now
      '**/node_modules/**', // Exclude all node_modules tests
      '**/*.e2e.{test,spec}.{js,ts}', // Exclude Playwright e2e tests
      '**/*.spec.{js,ts}', // Exclude .spec files (Playwright e2e only)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.svelte',
        '**/stories/**',
        'shared-components/**/scripts/**', // Exclude build scripts
      ],
      include: [
        'shared-components/otp-login/**/*.ts', // Include OTP login core for coverage
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

