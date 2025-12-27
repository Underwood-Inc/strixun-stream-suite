/**
 * Bundle OTP Login Svelte Component for Standalone HTML Use
 * 
 * Bundles the Svelte component with all dependencies for use in vanilla HTML
 */

import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const componentPath = resolve(__dirname, '../svelte/OtpLogin.svelte');
const outputDir = resolve(__dirname, '../dist');
const outputFile = resolve(outputDir, 'otp-login-svelte.js');

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build using Vite
  await build({
    plugins: [
      svelte({
        compilerOptions: {
          customElement: false,
        },
      }),
    ],
    build: {
      lib: {
        entry: componentPath,
        name: 'OtpLoginSvelte',
        fileName: 'otp-login-svelte',
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
      outDir: outputDir,
      write: true,
    },
    resolve: {
      alias: {
        '@shared-components': projectRoot,
      },
    },
  });

  console.log(`✅ Bundled OtpLogin Svelte component to ${outputFile}`);
  console.log(`   Load it in HTML with: <script src="/otp-login-svelte.js"></script>`);
  console.log(`   Then use: new OtpLoginSvelte({ target: element, props: {...} })`);
} catch (error) {
  console.error('❌ Failed to bundle OtpLogin Svelte component:', error);
  process.exit(1);
}

