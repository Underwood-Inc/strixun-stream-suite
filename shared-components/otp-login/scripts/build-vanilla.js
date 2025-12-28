/**
 * Build Vanilla JS OTP Login
 * 
 * Builds vanilla JavaScript/TypeScript output for use without frameworks
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '../..');
const corePath = join(__dirname, '../core.ts');
const outputDir = join(__dirname, '../dist/js');
const outputFile = join(outputDir, 'otp-login-core.js');
const outputFileMin = join(outputDir, 'otp-login-core.min.js');
const outputFileESM = join(outputDir, 'otp-login-core.esm.js');

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build IIFE version (for browser globals)
  await build({
    entryPoints: [corePath],
    bundle: true,
    outfile: outputFile,
    format: 'iife',
    globalName: 'OtpLoginCoreLib',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    resolveExtensions: ['.ts', '.js', '.json'],
    banner: {
      js: '// Bundled OtpLoginCore from shared-components/otp-login/core.ts\n// This file is auto-generated - do not edit manually\n',
    },
  });

  // Build minified IIFE version
  await build({
    entryPoints: [corePath],
    bundle: true,
    outfile: outputFileMin,
    format: 'iife',
    globalName: 'OtpLoginCoreLib',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    resolveExtensions: ['.ts', '.js', '.json'],
  });

  // Build ESM version (for modern browsers and bundlers)
  await build({
    entryPoints: [corePath],
    bundle: true,
    outfile: outputFileESM,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    resolveExtensions: ['.ts', '.js', '.json'],
  });

  // Read the bundled files and wrap IIFE versions to expose to window
  const bundled = readFileSync(outputFile, 'utf-8');
  const bundledMin = readFileSync(outputFileMin, 'utf-8');
  
  const wrapBundle = (content) => `(function() {
  'use strict';
  ${content}
  // Expose OtpLoginCore to window
  if (typeof window !== 'undefined' && typeof OtpLoginCoreLib !== 'undefined') {
    window.OtpLoginCore = OtpLoginCoreLib.OtpLoginCore || (() => {
      throw new Error('OtpLoginCore not found in bundle');
    });
  }
})();`;

  writeFileSync(outputFile, wrapBundle(bundled));
  writeFileSync(outputFileMin, wrapBundle(bundledMin));
  
  console.log(`[SUCCESS] Built Vanilla JS OTP Login to ${outputDir}/`);
  console.log(`   - IIFE (Development): otp-login-core.js`);
  console.log(`   - IIFE (Production): otp-login-core.min.js`);
  console.log(`   - ESM: otp-login-core.esm.js`);
} catch (error) {
  console.error('[ERROR] Failed to build Vanilla JS OTP Login:', error);
  process.exit(1);
}

