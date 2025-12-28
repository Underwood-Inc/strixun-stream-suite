/**
 * Build Svelte OTP Login Components
 * 
 * Builds Svelte components for distribution
 */

import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const entryPath = resolve(__dirname, '../svelte/OtpLogin.svelte');
const outputDir = resolve(__dirname, '../dist/svelte');
const svelteConfigPath = resolve(__dirname, '../svelte.config.js');

// Verify config file exists
if (!existsSync(svelteConfigPath)) {
  console.error(`❌ Svelte config not found at: ${svelteConfigPath}`);
  process.exit(1);
}

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build Svelte component as ES module
  await build({
    plugins: [
      svelte({
        configFile: svelteConfigPath,
        compilerOptions: {
          generate: 'dom',
          hydratable: false,
          css: 'injected',
        },
        onwarn: (warning, handler) => {
          // Suppress CSS unused selector warnings
          if (warning.code === 'css-unused-selector') return;
          // Suppress a11y warnings
          if (warning.code?.startsWith('a11y-')) return;
          // Call default handler for other warnings
          handler(warning);
        },
      }),
    ],
    build: {
      lib: {
        entry: entryPath,
        name: 'OtpLogin',
        fileName: 'otp-login',
        formats: ['es'],
      },
      rollupOptions: {
        external: ['svelte'],
        output: {
          globals: {
            svelte: 'Svelte',
          },
        },
      },
      outDir: outputDir,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@shared-components': projectRoot,
        '@shared-config': resolve(projectRoot, 'shared-config'),
        '@shared-styles': resolve(projectRoot, 'shared-styles'),
      },
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    optimizeDeps: {
      exclude: ['svelte'],
    },
  });

  console.log(`✅ Built Svelte OTP Login components to ${outputDir}/`);
  console.log(`   - ES Module: otp-login.js`);
} catch (error) {
  console.error('❌ Failed to build Svelte OTP Login components:', error);
  process.exit(1);
}

