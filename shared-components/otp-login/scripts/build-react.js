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
import { mkdirSync, existsSync, writeFileSync } from 'fs';

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

  // Generate index.js re-export file (value exports only - no types in JS)
  const indexContent = `/**
 * React OTP Login Components
 * 
 * This file is auto-generated - do not edit manually
 * Import from this file to use the built React components
 */

export { OtpLogin } from './otp-login.js';

`;
  writeFileSync(resolve(outputDir, 'index.js'), indexContent, 'utf-8');

  // Generate index.d.ts type definition file
  const indexDtsContent = `/**
 * React OTP Login Components - Type Definitions
 * 
 * This file is auto-generated - do not edit manually
 */

export { OtpLogin } from './otp-login.js';
export type { OtpLoginProps } from './otp-login.js';
export type { LoginSuccessData, OtpLoginState, OtpLoginConfig } from '../../core.js';

`;
  writeFileSync(resolve(outputDir, 'index.d.ts'), indexDtsContent, 'utf-8');

  console.log(`✅ Built React OTP Login components to ${outputDir}/`);
  console.log(`   - ES Module: otp-login.js`);
  console.log(`   - CommonJS: otp-login.cjs`);
  console.log(`   - Index: index.js`);
  console.log(`   - Types: index.d.ts`);
} catch (error) {
  console.error('❌ Failed to build React OTP Login components:', error);
  process.exit(1);
}

