/**
 * Build script that ensures VITE_SERVICE_ENCRYPTION_KEY is available to Vite
 * This script explicitly passes the environment variable to the Vite build process
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const appDir = join(projectRoot, 'app');

// Debug: Log all VITE_* environment variables (without exposing the full key)
console.log('[DEBUG] Checking for VITE_SERVICE_ENCRYPTION_KEY in environment...');
const viteEnvVars = Object.keys(process.env).filter(key => key.startsWith('VITE_'));
console.log(`[DEBUG] Found ${viteEnvVars.length} VITE_* environment variables:`, viteEnvVars);

// Get the encryption key from environment
const encryptionKey = process.env.VITE_SERVICE_ENCRYPTION_KEY;

if (!encryptionKey) {
  console.error('[ERROR] VITE_SERVICE_ENCRYPTION_KEY is not set in environment');
  console.error('This key is required for building the app. Please set it in your CI/CD environment.');
  console.error('[DEBUG] Available environment variables:', Object.keys(process.env).filter(k => k.includes('ENCRYPTION') || k.includes('KEY')));
  process.exit(1);
}

if (encryptionKey.length < 32) {
  console.error(`[ERROR] VITE_SERVICE_ENCRYPTION_KEY is too short (${encryptionKey.length} chars, need 32+)`);
  process.exit(1);
}

console.log(`[INFO] Building app with encryption key (length: ${encryptionKey.length})`);

// Set the environment variable and run the build
// This ensures Vite can access it during the build process
process.env.VITE_SERVICE_ENCRYPTION_KEY = encryptionKey;

try {
  // Change to app directory and run pnpm build
  // The environment variable will be available to Vite
  execSync('pnpm build', {
    cwd: appDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_SERVICE_ENCRYPTION_KEY: encryptionKey,
    },
  });
  
  console.log('[SUCCESS] App build completed');
} catch (error) {
  console.error('[ERROR] App build failed:', error.message);
  process.exit(1);
}

