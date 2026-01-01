/**
 * Wrapper script to start a worker and check health with JWT
 * Used by Playwright webServer since it doesn't support custom headers
 * 
 * This script starts wrangler and performs health checks with JWT.
 * Playwright will still do its own health checks (which will fail with 401),
 * but this script ensures the server is actually ready before Playwright times out.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [workerDir, port] = process.argv.slice(2);

if (!workerDir || !port) {
  console.error('Usage: node start-worker-with-health-check.js <worker-dir> <port>');
  process.exit(1);
}

const jwtToken = process.env.E2E_TEST_JWT_TOKEN;
if (!jwtToken) {
  console.error('[Worker Start] E2E_TEST_JWT_TOKEN not set');
  process.exit(1);
}

const healthUrl = `http://localhost:${port}/health`;
const workerPath = join(__dirname, '..', workerDir);

console.log(`[Worker Start] Starting ${workerDir} on port ${port}...`);

// Start wrangler dev
const wrangler = spawn('wrangler', ['dev', '--port', port, '--local'], {
  cwd: workerPath,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

let healthCheckPassed = false;
let healthCheckAttempts = 0;
const maxAttempts = 90; // 90 attempts * 2 seconds = 3 minutes max
const checkInterval = 2000; // Check every 2 seconds

// Wait for health check to pass before allowing Playwright to proceed
// This blocks until health check succeeds or max attempts reached
const waitForHealth = async () => {
  // Wait a bit for wrangler to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  while (!healthCheckPassed && healthCheckAttempts < maxAttempts) {
    healthCheckAttempts++;
    
    try {
      const response = await fetch(healthUrl, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      });

      if (response.ok) {
        console.log(`[Worker Start] ✓ ${workerDir} is healthy (checked with JWT)`);
        healthCheckPassed = true;
        return; // Health check passed, proceed
      } else {
        if (healthCheckAttempts % 10 === 0) {
          console.log(`[Worker Start] Waiting for ${workerDir}... (attempt ${healthCheckAttempts}/${maxAttempts}, status: ${response.status})`);
        }
      }
    } catch (error) {
      if (healthCheckAttempts % 10 === 0) {
        console.log(`[Worker Start] Waiting for ${workerDir}... (attempt ${healthCheckAttempts}/${maxAttempts}, error: ${error.message})`);
      }
    }
    
    // Wait before next attempt
    if (!healthCheckPassed) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  // If we get here, health check failed
  if (!healthCheckPassed) {
    console.error(`[Worker Start] ✗ ${workerDir} health check failed after ${maxAttempts} attempts`);
    wrangler.kill();
    process.exit(1);
  }
};

// Start health check wait (non-blocking for wrangler process)
waitForHealth().catch((error) => {
  console.error(`[Worker Start] ✗ ${workerDir} health check error:`, error);
  wrangler.kill();
  process.exit(1);
});

// Handle process exit
process.on('SIGINT', () => {
  wrangler.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  wrangler.kill();
  process.exit(0);
});

wrangler.on('exit', (code) => {
  process.exit(code || 0);
});
