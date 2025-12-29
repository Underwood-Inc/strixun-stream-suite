/**
 * Bundle OTP Login Svelte Component for Standalone HTML Use
 * 
 * Bundles the Svelte component with all dependencies for use in vanilla HTML
 */

import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = resolve(__dirname, '../..');
const entryPath = resolve(__dirname, '../entry.ts');
const outputDir = resolve(__dirname, '../dist');
const svelteConfigPath = resolve(__dirname, '../svelte.config.js');

// Verify config file exists
import { existsSync } from 'fs';
if (!existsSync(svelteConfigPath)) {
  console.error(`❌ Svelte config not found at: ${svelteConfigPath}`);
  process.exit(1);
}

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build using Vite
  await build({
    plugins: [
      svelte({
        configFile: svelteConfigPath,
        compilerOptions: {
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
        name: 'OtpLoginSvelte',
        fileName: 'otp-login-svelte',
        formats: ['iife'],
      },
      rollupOptions: {
        output: {
          extend: true,
        },
        external: [],
      },
      outDir: outputDir,
      write: true,
      minify: 'terser', // Minify for production CDN
      sourcemap: false, // Disable sourcemaps for CDN (smaller size)
    },
    resolve: {
      alias: {
        '@shared-components': projectRoot,
      },
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log(`✅ Bundled OtpLogin Svelte component to ${outputDir}/otp-login-svelte.js`);
  console.log(`   Load it in HTML with: <script src="/otp-login-svelte.js"></script>`);
  console.log(`   Then use: OtpLoginSvelte.mountOtpLogin({ target: element, ...props })`);
  console.log(`   CDN Usage: <script src="https://cdn.example.com/otp-login-svelte.js"></script>`);
} catch (error) {
  console.error('❌ Failed to bundle OtpLogin Svelte component:', error);
  process.exit(1);
}

