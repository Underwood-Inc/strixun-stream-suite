/**
 * Build script for ASCIImoji package
 * Creates CDN-ready JavaScript bundle
 */

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Get project root: packages/asciimoji/scripts -> packages/asciimoji -> packages -> project root
const projectRoot = resolve(__dirname, '../../..');
const rootDir = join(__dirname, '..');
const corePath = join(rootDir, 'core.ts');
const outputDir = resolve(projectRoot, 'dist/asciimoji/js');
const outputFile = join(outputDir, 'index.js');
const outputFileMin = join(outputDir, 'index.min.js');
const outputFileESM = join(outputDir, 'index.esm.js');

// Ensure dist directory exists
mkdirSync(outputDir, { recursive: true });

(async () => {
  try {
    // Build IIFE version (for browser globals)
    await build({
      entryPoints: [corePath],
      bundle: true,
      outfile: outputFile,
      format: 'iife',
      globalName: 'AsciimojiLib',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      resolveExtensions: ['.ts', '.js', '.json'],
      banner: {
        js: '// Bundled ASCIImoji from @strixun/asciimoji\n// This file is auto-generated - do not edit manually\n',
      },
    });

    // Build minified IIFE version
    await build({
      entryPoints: [corePath],
      bundle: true,
      outfile: outputFileMin,
      format: 'iife',
      globalName: 'AsciimojiLib',
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
  // Expose AsciimojiTransformer and transformAsciimojiText to window
  if (typeof window !== 'undefined' && typeof AsciimojiLib !== 'undefined') {
    window.AsciimojiTransformer = AsciimojiLib.AsciimojiTransformer || (() => {
      throw new Error('AsciimojiTransformer not found in bundle');
    });
    window.transformAsciimojiText = AsciimojiLib.transformAsciimojiText || (() => {
      throw new Error('transformAsciimojiText not found in bundle');
    });
  }
})();`;

    writeFileSync(outputFile, wrapBundle(bundled));
    writeFileSync(outputFileMin, wrapBundle(bundledMin));
    
    console.log(`✓ Built ASCIImoji bundle to ${outputDir}/`);
    console.log(`   - IIFE (Development): index.js`);
    console.log(`   - IIFE (Production): index.min.js`);
    console.log(`   - ESM: index.esm.js`);
  } catch (error) {
    console.error('✗ Failed to build ASCIImoji bundle:', error);
    process.exit(1);
  }
})();
