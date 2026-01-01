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

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

const environment = process.argv[2] || 'dev';

if (environment !== 'dev' && environment !== 'prod') {
  console.error(`Invalid environment: ${environment}. Use 'dev' or 'prod'.`);
  process.exit(1);
}

// Set environment variables - ALWAYS use localhost
process.env.TEST_ENV = environment;
process.env.CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';
process.env.OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';

console.log(`[Integration Tests] Running with ${environment} configuration...`);
console.log(`[Integration Tests] TEST_ENV=${environment}`);
console.log(`[Integration Tests] CUSTOMER_API_URL=${process.env.CUSTOMER_API_URL}`);
console.log(`[Integration Tests] OTP_AUTH_SERVICE_URL=${process.env.OTP_AUTH_SERVICE_URL}`);
console.log('');

let otpWorkerProcess = null;
let customerApiProcess = null;

/**
 * Wait for a service to be ready by polling its health endpoint
 */
async function waitForService(name, url, maxAttempts = 30, delay = 1000) {
  console.log(`[Integration Tests] Waiting for ${name} to be ready at ${url}...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      // Any response (even 404/401) means the service is running
      console.log(`[Integration Tests] ✓ ${name} is ready!`);
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed to connect to ${name} at ${url} after ${maxAttempts} attempts: ${error.message}`);
      }
    }
  }
  return false;
}

/**
 * Start a worker process
 */
function startWorker(name, cwd, command, port) {
  console.log(`[Integration Tests] Starting ${name}...`);
  const isWindows = process.platform === 'win32';
  const processOptions = {
    cwd,
    stdio: 'pipe',
    shell: isWindows,
  };
  
  const proc = spawn(command, [], processOptions);
  
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    // Only show important messages to reduce noise
    if (output.includes('Ready') || output.includes('wrangler') || output.includes('error') || output.includes('Error')) {
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
    // Start OTP Auth Service worker
    const otpAuthServiceDir = join(__dirname, '..');
    otpWorkerProcess = startWorker(
      'OTP Auth Service',
      otpAuthServiceDir,
      'pnpm dev',
      8787
    );
    
    // Start Customer API worker
    const customerApiDir = join(rootDir, 'serverless/customer-api');
    customerApiProcess = startWorker(
      'Customer API',
      customerApiDir,
      'pnpm dev',
      8790
    );
    
    // Wait for both services to be ready
    await Promise.all([
      waitForService('OTP Auth Service', `${process.env.OTP_AUTH_SERVICE_URL}/health`),
      waitForService('Customer API', `${process.env.CUSTOMER_API_URL}/customer/by-email/test@example.com`),
    ]);
    
    console.log('\n[Integration Tests] Both services are ready! Running tests...\n');
    
    // Run vitest - run both customer creation and OTP login flow tests
    execSync('vitest run customer-creation.integration.test.ts otp-login-flow.integration.test.ts', {
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

