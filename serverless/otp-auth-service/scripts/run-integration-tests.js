#!/usr/bin/env node
/**
 * Cross-platform script to run integration tests with LOCAL workers only
 * Usage: node scripts/run-integration-tests.js [dev|prod]
 * 
 * CRITICAL: Integration tests ONLY work with LOCAL workers!
 * - Automatically starts OTP Auth Service on http://localhost:8787
 * - Automatically starts Customer API on http://localhost:8790
 * - Waits for both services to be ready before running tests
 * - Cleans up workers after tests complete
 */

import { spawn, execSync, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From serverless/otp-auth-service/scripts, go up 3 levels to reach root
const rootDir = join(__dirname, '../../..');

const environment = process.argv[2] || 'dev';

if (environment !== 'dev' && environment !== 'prod') {
  console.error(`Invalid environment: ${environment}. Use 'dev' or 'prod'.`);
  process.exit(1);
}

// Set environment variables - ALWAYS use localhost
process.env.TEST_ENV = environment;
process.env.CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';
process.env.OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
// Ensure integrity keyphrase is set for service-to-service calls
process.env.NETWORK_INTEGRITY_KEYPHRASE = process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests';

console.log(`[Integration Tests] Running with ${environment} configuration...`);
console.log(`[Integration Tests] TEST_ENV=${environment}`);
console.log(`[Integration Tests] CUSTOMER_API_URL=${process.env.CUSTOMER_API_URL}`);
console.log(`[Integration Tests] OTP_AUTH_SERVICE_URL=${process.env.OTP_AUTH_SERVICE_URL}`);
console.log('');

let otpWorkerProcess = null;
let customerApiProcess = null;
// Temporary .dev.vars files for integration tests
let otpDevVarsPath = null;
let customerApiDevVarsPath = null;

/**
 * Create temporary .dev.vars files for workers to ensure required secrets are set
 */
function createDevVarsFiles() {
  const integrityKeyphrase = process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests';
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests';
  // CRITICAL: Must start with 're_test_' for /dev/otp endpoint to work
  const resendApiKey = process.env.RESEND_API_KEY || 're_test_key_for_integration_tests';
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'test@example.com';
  // Generate a test OTP code for integration tests (9 digits)
  const testOtpCode = process.env.E2E_TEST_OTP_CODE || Math.floor(100000000 + Math.random() * 900000000).toString();
  
  // Create .dev.vars for OTP Auth Service (needs RESEND_API_KEY for OTP emails)
  // Set ENVIRONMENT=test to bypass rate limits AND enable /dev/otp endpoint for integration tests
  // Set CUSTOMER_API_URL for service-to-service calls
  const customerApiUrl = process.env.CUSTOMER_API_URL || 'http://localhost:8790';
  const otpDevVarsDir = join(__dirname, '..');
  otpDevVarsPath = join(otpDevVarsDir, '.dev.vars');
  writeFileSync(otpDevVarsPath, `NETWORK_INTEGRITY_KEYPHRASE=${integrityKeyphrase}\nJWT_SECRET=${jwtSecret}\nRESEND_API_KEY=${resendApiKey}\nRESEND_FROM_EMAIL=${resendFromEmail}\nENVIRONMENT=test\nE2E_TEST_OTP_CODE=${testOtpCode}\nCUSTOMER_API_URL=${customerApiUrl}\n`);
  
  // Also set in process.env so tests can access it
  process.env.E2E_TEST_OTP_CODE = testOtpCode;
  
  // Create .dev.vars for Customer API
  const customerApiDevVarsDir = join(rootDir, 'serverless/customer-api');
  customerApiDevVarsPath = join(customerApiDevVarsDir, '.dev.vars');
  writeFileSync(customerApiDevVarsPath, `NETWORK_INTEGRITY_KEYPHRASE=${integrityKeyphrase}\nJWT_SECRET=${jwtSecret}\n`);
}

/**
 * Wait for a service to be ready by polling its health endpoint
 */
async function waitForService(name, url, maxAttempts = 5, delay = 1000) {
  console.log(`[Integration Tests] Waiting for ${name} to be ready at ${url}...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      // Verify response is actually from a running service
      // For /health endpoint, 401 is expected (requires JWT) - verify it's a proper 401
      if (response.status === 401 && url.includes('/health')) {
        const responseText = await response.text();
        if (responseText.includes('JWT token') || responseText.includes('Unauthorized')) {
          // Proper 401 means service is running and responding correctly
          console.log(`[Integration Tests] ✓ ${name} is ready! (status: 401 - service requires JWT)`);
          return true;
        }
      } else if (response.status === 200) {
        // 200 means service is fully healthy
        console.log(`[Integration Tests] ✓ ${name} is ready! (status: 200)`);
        return true;
      } else if (response.status === 404) {
        // 404 might mean endpoint doesn't exist, but service is running
        console.log(`[Integration Tests] ⚠ ${name} returned 404 - service is running but endpoint may not exist`);
        return true;
      } else {
        // Other status - service is responding but may have issues
        console.log(`[Integration Tests] ⚠ ${name} is responding but returned status ${response.status}`);
        return true;
      }
    } catch (error: any) {
      // Fetch failed - service is NOT running
      // Do NOT treat this as "service is running" - it's a connection failure
      if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        // Connection refused or timeout - service not ready yet
        // Wait and retry
        if (i < maxAttempts - 1) {
          console.log(`[Integration Tests] Still waiting for ${name}... (attempt ${i + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      // Other unexpected errors - log but don't treat as "running"
      console.log(`[Integration Tests] ${name} connection error: ${error.message}`);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      // If we get here, we've exhausted retries
      throw new Error(`Failed to connect to ${name} at ${url} after ${maxAttempts} attempts: ${error.message}`);
    }
  }
  return false;
}

/**
 * Start a worker process using CI-compatible wrapper script
 */
function startWorker(name, workerDir, port) {
  console.log(`[Integration Tests] Starting ${name}...`);
  
  // Use the CI-compatible wrapper script (same as playwright.config.ts)
  // This is the established working pattern that works in CI
  // The wrapper script requires E2E_TEST_JWT_TOKEN for health checks, but integration tests
  // don't need JWT for health - they just need the service running
  // So we'll use the wrapper but it will do a basic health check
  const wrapperScript = join(rootDir, 'scripts', 'start-worker-with-health-check.js');
  
  // Set up env - ensure NETWORK_INTEGRITY_KEYPHRASE matches between services
  const workerEnv = {
    ...process.env,
    CI: 'true',
    NO_INPUT: '1',
    // Wrapper script needs E2E_TEST_JWT_TOKEN for health check
    E2E_TEST_JWT_TOKEN: process.env.E2E_TEST_JWT_TOKEN || 'dummy-token-for-integration-tests',
    // Ensure integrity keyphrase matches (required for service-to-service calls)
    NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
  };
  
  const proc = spawn('node', [wrapperScript, workerDir, String(port)], {
    stdio: 'pipe',
    shell: false, // Spawn node directly - CI compatible
    env: workerEnv,
  });
  
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    // Only show important messages to reduce noise
    if (output.includes('Ready') || output.includes('wrangler') || output.includes('error') || output.includes('Error') || output.includes('healthy')) {
      process.stdout.write(`[${name}] ${output}`);
    }
  });
  
  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });
  
  proc.on('error', (error) => {
    console.error(`[Integration Tests] Failed to start ${name}:`, error);
  });
  
  return proc;
}

/**
 * Cleanup function to kill worker processes
 */
function cleanup() {
  console.log('\n[Integration Tests] Cleaning up workers...');
  
  if (otpWorkerProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${otpWorkerProcess.pid}`, { stdio: 'ignore' });
      } else {
        process.kill(-otpWorkerProcess.pid, 'SIGTERM');
      }
      console.log('[Integration Tests] ✓ OTP Auth Service stopped');
    } catch (error) {
      // Process might already be dead, ignore
    }
  }
  
  if (customerApiProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${customerApiProcess.pid}`, { stdio: 'ignore' });
      } else {
        process.kill(-customerApiProcess.pid, 'SIGTERM');
      }
      console.log('[Integration Tests] ✓ Customer API stopped');
    } catch (error) {
      // Process might already be dead, ignore
    }
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

process.on('exit', cleanup);

// Main execution
(async () => {
  try {
    // Create temporary .dev.vars files to ensure NETWORK_INTEGRITY_KEYPHRASE is set
    createDevVarsFiles();
    
    // Start OTP Auth Service worker using CI-compatible wrapper
    otpWorkerProcess = startWorker(
      'OTP Auth Service',
      'serverless/otp-auth-service',
      8787
    );
    
    // Start Customer API worker using CI-compatible wrapper
    customerApiProcess = startWorker(
      'Customer API',
      'serverless/customer-api',
      8790
    );
    
    // Wait for both services to be ready
    await Promise.all([
      waitForService('OTP Auth Service', `${process.env.OTP_AUTH_SERVICE_URL}/health`),
      waitForService('Customer API', `${process.env.CUSTOMER_API_URL}/customer/by-email/test@example.com`),
    ]);
    
    console.log('\n[Integration Tests] Both services are ready! Running tests...\n');
    
    // Give services a moment to fully initialize after health checks
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run vitest - run both customer creation and OTP login flow tests
    // Use pnpm exec to ensure vitest is found (CI compatible)
    execSync('pnpm exec vitest run customer-creation.integration.test.ts otp-login-flow.integration.test.ts', {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
      env: process.env,
    });
    
    console.log('\n[Integration Tests] ✓ All tests passed!');
    cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n[Integration Tests] ✗ Tests failed!', error.message);
    cleanup();
    process.exit(1);
  }
})();

