const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const chokidar = require('chokidar');

const dashboardDir = path.join(__dirname, '..', 'dashboard');
const rootDir = path.join(__dirname, '..');

let buildProcess = null;
let wranglerProcess = null;
let isBuilding = false;
let buildQueue = [];


// Build function
async function build() {
  if (isBuilding) {
    buildQueue.push(true);
    return;
  }
  
  isBuilding = true;
  console.log('\n[SYNC] Rebuilding dashboard...');
  
  try {
    const buildScript = path.join(__dirname, 'build-dashboard.js');
    // Use execSync instead of spawn to properly handle paths with spaces on Windows
    execSync(`node "${buildScript}"`, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env
    });
    console.log('[SUCCESS] Rebuild complete!\n');
  } catch (error) {
    console.error(`[ERROR] Build failed with exit code ${error.status || 1}\n`);
    throw new Error(`Build exited with code ${error.status || 1}`);
  } finally {
    isBuilding = false;
    
    // Process queued builds
    if (buildQueue.length > 0) {
      buildQueue.shift();
      setTimeout(build, 500);
    }
  }
}

// Watch for changes
const watcher = chokidar.watch([
  path.join(dashboardDir, 'src/**/*'),
  path.join(dashboardDir, 'index.html'),
  path.join(dashboardDir, 'vite.config.ts'),
  path.join(dashboardDir, 'tsconfig.json'),
  path.join(rootDir, 'src/**/*'),
  path.join(rootDir, 'index.html'),
  path.join(rootDir, 'vite.config.ts'),
  path.join(rootDir, 'tsconfig.json'),
  path.join(rootDir, 'worker.js')
], {
  ignored: [
    /node_modules/,
    /\.wrangler/,
    /dist/,
    /\.svelte-kit/,
    /dashboard-assets\.js/,
    /landing-page-assets\.js/
  ],
  persistent: true,
  ignoreInitial: true
});

let rebuildTimeout = null;
watcher.on('change', (filePath) => {
  const relativePath = path.relative(rootDir, filePath);
  console.log(`\n[NOTE] File changed: ${relativePath}`);
  
  // Debounce rebuilds
  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout);
  }
  
  rebuildTimeout = setTimeout(() => {
    if (filePath.includes('dashboard') || (filePath.includes('src') && !filePath.includes('dashboard'))) {
      // Dashboard or landing page changed - rebuild both
      build();
    } else if (filePath.includes('worker.js')) {
      // Worker changed - wrangler will auto-reload
      console.log('[NOTE] Worker changed - wrangler will auto-reload');
    }
  }, 500);
});

// Start wrangler dev
function startWrangler() {
  console.log('[DEPLOY] Starting wrangler dev...\n');
  
  // On Windows, use shell: true to properly handle pnpm execution
  const isWindows = process.platform === 'win32';
  
  wranglerProcess = spawn('pnpm', ['exec', 'wrangler', 'dev', '--env', 'production'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env
  });
  
  wranglerProcess.on('close', (code) => {
    console.log(`\n[WARNING]  Wrangler exited with code ${code}`);
    process.exit(code);
  });
  
  wranglerProcess.on('error', (error) => {
    console.error('[ERROR] Wrangler error:', error);
    process.exit(1);
  });
}

// Initial build
console.log('[EMOJI] Building dashboard and landing page for preview...\n');

build().then(() => {
  console.log('[EMOJI] Watching for changes...\n');
  startWrangler();
}).catch((error) => {
  console.error('[ERROR] Initial build failed:', error);
  process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n[EMOJI] Stopping watch mode...');
  watcher.close();
  if (wranglerProcess) {
    wranglerProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  watcher.close();
  if (wranglerProcess) {
    wranglerProcess.kill();
  }
  process.exit(0);
});

