/**
 * Bundle OTP Login Core for Browser Use
 * 
 * Bundles the shared OtpLoginCore for use in standalone HTML
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '../..');
const corePath = join(__dirname, '../core.ts');
const outputDir = join(__dirname, '../../../dist/otp-login/js');
const outputFile = join(outputDir, 'otp-core.js');
const outputFileMin = join(outputDir, 'otp-core.min.js');

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

try {
  // Build unminified version (for debugging)
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
    // Note: esbuild automatically resolves relative imports when bundle: true
    // The core.ts imports from '../../shared-config/otp-config.js' which should resolve correctly
    banner: {
      js: '// Bundled OtpLoginCore from shared-components/otp-login/core.ts\n// This file is auto-generated - do not edit manually\n',
    },
  });

  // Build minified version (for production CDN)
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
    // Note: esbuild automatically resolves relative imports when bundle: true
    // The core.ts imports from '../../shared-config/otp-config.js' which should resolve correctly
  });

  // Read the bundled files and wrap them to expose to window
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
  
  console.log(`✓ Bundled OtpLoginCore:`);
  console.log(`   - Development: ${outputFile}`);
  console.log(`   - Production (minified): ${outputFileMin}`);
} catch (error) {
  console.error('✗ Failed to bundle OtpLoginCore:', error);
  process.exit(1);
}

