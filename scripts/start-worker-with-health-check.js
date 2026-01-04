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

// Try both localhost and 127.0.0.1 (Windows networking quirk)
const healthUrls = [
  `http://localhost:${port}/health`,
  `http://127.0.0.1:${port}/health`
];
const workerPath = join(__dirname, '..', workerDir);

// Calculate unique inspector port to avoid conflicts (9229 + offset based on worker port)
// Base port is 8787, so offset = port - 8787, then add to 9229
const inspectorPort = 9229 + (parseInt(port, 10) - 8787);

console.log(`[Worker Start] Starting ${workerDir} on port ${port} (inspector port ${inspectorPort})...`);

// Start wrangler dev with unique inspector port to avoid port 9229 conflicts
const wrangler = spawn('wrangler', ['dev', '--port', port, '--local', '--inspector-port', String(inspectorPort)], {
  cwd: workerPath,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

let healthCheckPassed = false;
let healthCheckAttempts = 0;
const maxAttempts = 90; // 90 attempts * 2 seconds = 3 minutes max
const checkInterval = 2000; // Check every 2 seconds

// Wait for wrangler to be ready, then do a simple health check
// This blocks until wrangler is ready and health check succeeds
const waitForHealth = async () => {
  // Wait for wrangler to start (it will print "Ready on http://127.0.0.1:PORT")
  // Give it plenty of time on Windows
  console.log(`[Worker Start] Waiting for ${workerDir} to start...`);
  await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds for wrangler to start
  
  console.log(`[Worker Start] Verifying ${workerDir} health...`);
  
  // Now do health checks (with retries)
  while (!healthCheckPassed && healthCheckAttempts < maxAttempts) {
    healthCheckAttempts++;
    
    // Try each health URL (localhost and 127.0.0.1)
    for (const healthUrl of healthUrls) {
      try {
        // Try without JWT first (health endpoint might be public)
        let response = null;
        try {
          response = await fetch(healthUrl, {
            signal: AbortSignal.timeout(3000),
          });
        } catch (noJwtError) {
          // If that fails, try with JWT
          try {
            response = await fetch(healthUrl, {
              headers: {
                'Authorization': `Bearer ${jwtToken}`,
              },
              signal: AbortSignal.timeout(3000),
            });
          } catch (jwtError) {
            // Both failed for this URL, try next URL
            continue;
          }
        }

        // Verify response is actually healthy
        if (response) {
          if (response.ok) {
            // 200 means service is fully healthy
            console.log(`[Worker Start] ✓ ${workerDir} is healthy (status: ${response.status})`);
            healthCheckPassed = true;
            return;
          } else if (response.status === 401) {
            // Health endpoint requires JWT, so 401 is expected - verify it's a proper 401 response
            const responseText = await response.text();
            if (responseText.includes('JWT token') || responseText.includes('Unauthorized')) {
              // Proper 401 means service is running and responding correctly
              console.log(`[Worker Start] ✓ ${workerDir} is healthy (status: ${response.status} - service requires JWT)`);
              healthCheckPassed = true;
              return;
            }
          } else if (response.status === 404) {
            // 404 might mean endpoint doesn't exist, but service is running
            console.log(`[Worker Start] ⚠ ${workerDir} returned 404 - service is running but endpoint may not exist`);
            healthCheckPassed = true;
            return;
          }
        }
      } catch (error) {
        // Connection errors - service is NOT running, wait and retry
        // Do NOT treat this as "service is running"
        continue;
      }
    }
    
    // If we get here, all URLs failed - wait and retry
    console.log(`[Worker Start] Health check failed, retrying... (attempt ${healthCheckAttempts}/${maxAttempts})`);
    
    if (healthCheckAttempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } else {
      // Exhausted retries - worker failed to start
      throw new Error(`[Worker Start] ✗ ${workerDir} failed to start after ${maxAttempts} attempts. Check worker logs for errors.`);
    }
  }
  
  // If we get here, health check passed
  if (!healthCheckPassed) {
    throw new Error(`[Worker Start] ✗ ${workerDir} health check failed after ${maxAttempts} attempts`);
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
