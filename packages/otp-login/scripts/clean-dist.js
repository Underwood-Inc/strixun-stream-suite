/**
 * Clean dist directory
 * Cross-platform script to remove dist folder
 */

import { rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = resolve(__dirname, '../dist');

try {
  rmSync(distDir, { recursive: true, force: true });
  console.log(`✓ Cleaned dist directory: ${distDir}`);
} catch (error) {
  // Directory might not exist, which is fine
  if (error.code !== 'ENOENT') {
    console.error('✗ Failed to clean dist directory:', error);
    process.exit(1);
  }
}

