/**
 * Build React OTP Login Components
 * 
 * Builds React components for distribution
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const entryPath = resolve(__dirname, '../react/OtpLogin.tsx');
const outputDir = resolve(__dirname, '../dist/react');

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build React component as ES module and CommonJS
  await build({
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
    build: {
      lib: {
        entry: entryPath,
        name: 'OtpLogin',
        fileName: (format) => {
          if (format === 'es') return 'otp-login.js';
          if (format === 'cjs') return 'otp-login.cjs';
          return 'otp-login.js';
        },
        formats: ['es', 'cjs'],
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
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
  });

  console.log(`[SUCCESS] Built React OTP Login components to ${outputDir}/`);
  console.log(`   - ES Module: otp-login.js`);
  console.log(`   - CommonJS: otp-login.cjs`);
} catch (error) {
  console.error('[ERROR] Failed to build React OTP Login components:', error);
  process.exit(1);
}

