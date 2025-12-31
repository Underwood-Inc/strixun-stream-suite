/**
 * Browser Sync Setup
 * Proxies to wrangler dev and watches dist folder for auto-refresh
 */

import browserSync from 'browser-sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const appDistDir = join(projectRoot, 'app', 'dist');

browserSync.init({
  proxy: 'http://localhost:8787',
  port: 3000,
  open: false,
  notify: false,
  files: [
    join(appDistDir, '**/*.html'),
    join(appDistDir, '**/*.js'),
    join(appDistDir, '**/*.css'),
  ],
  watchOptions: {
    ignoreInitial: true,
  },
  reloadDebounce: 500,
  reloadOnRestart: true,
}, (err, bs) => {
  if (err) {
    console.error('[BrowserSync] ✗ Failed to start:', err);
    process.exit(1);
  }
  console.log('[BrowserSync] ✓ Started on http://localhost:3000');
  console.log('[BrowserSync] Proxying to http://localhost:8787');
  console.log('[BrowserSync] Watching:', appDistDir);
});

