/**
 * Watch script for app development
 * Watches app source files and rebuilds app + assets automatically
 */

import { watch } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const appSrcDir = join(projectRoot, 'app', 'src');

let rebuildTimeout = null;
let isRebuilding = false;

function rebuildApp() {
  if (isRebuilding) {
    return;
  }

  isRebuilding = true;
  console.log('[WATCH] Rebuilding app and assets...');

  try {
    // Build the app (includes prebuild for otp-login)
    execSync('pnpm build:app', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Build app assets
    execSync('pnpm build:app-assets', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    console.log('[WATCH] ✓ App rebuilt successfully');
  } catch (error) {
    console.error('[WATCH] ✗ Rebuild failed:', error);
  } finally {
    isRebuilding = false;
  }
}

function debouncedRebuild() {
  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout);
  }

  rebuildTimeout = setTimeout(() => {
    rebuildApp();
  }, 500);
}

console.log('[WATCH] Watching app source files for changes...');
console.log(`[WATCH] Watching: ${appSrcDir}`);

// Watch the app src directory recursively
try {
  watch(appSrcDir, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.git')) {
      console.log(`[WATCH] File changed: ${filename}`);
      debouncedRebuild();
    }
  });
} catch (error) {
  console.error('[WATCH] ✗ Could not watch source folder:', error.message);
  process.exit(1);
}

console.log('[WATCH] Ready! Make changes to app files and they will be rebuilt automatically.');
console.log('[WATCH] Press Ctrl+C to stop watching.');
