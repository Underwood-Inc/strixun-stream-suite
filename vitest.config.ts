import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

const workspacePackageRoot = resolve(__dirname, 'packages');

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
      'packages/shared-components/**/*.test.{js,ts,tsx}',
      'scripts/**/*.test.{js,ts}',
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
      // Svelte component fixtures need @tanstack/svelte-table .svelte entry — run in package vitest only.
      'packages/shared-components/svelte/**/*.fixture.test.ts',
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
        'scripts/setup-cloud-ide.js', // Include setup script for coverage
      ],
    },
  },
  resolve: {
    // Workspace packages export dist/* only; alias to TypeScript sources so root vitest
    // resolves the same locally and in CI without a separate package build step.
    alias: [
      {
        find: '@strixun/feature-flags',
        replacement: resolve(workspacePackageRoot, 'feature-flags/src/index.ts'),
      },
      {
        find: '@strixun/api-framework/client',
        replacement: resolve(workspacePackageRoot, 'api-framework/client.ts'),
      },
      {
        find: '@strixun/api-framework/enhanced',
        replacement: resolve(workspacePackageRoot, 'api-framework/enhanced.ts'),
      },
      {
        find: '@strixun/api-framework/jwt',
        replacement: resolve(workspacePackageRoot, 'api-framework/jwt.ts'),
      },
      {
        find: '@strixun/api-framework',
        replacement: resolve(workspacePackageRoot, 'api-framework/index.ts'),
      },
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@components', replacement: resolve(__dirname, './src/lib/components') },
      { find: '@modules', replacement: resolve(__dirname, './src/modules') },
      { find: '@stores', replacement: resolve(__dirname, './src/stores') },
      { find: '@styles', replacement: resolve(__dirname, './src/styles') },
      {
        find: '@shared-components',
        replacement: resolve(__dirname, './packages/shared-components'),
      },
      { find: '@shared-styles', replacement: resolve(__dirname, './shared-styles') },
    ],
  },
});

