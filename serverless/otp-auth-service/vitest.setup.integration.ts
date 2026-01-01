/**
 * Vitest Global Setup for Integration Tests
 * Automatically starts required workers before integration tests run
 * 
 * This setup file is loaded when running integration tests and ensures
 * all required services (OTP Auth Service, Customer API) are running
 * before tests execute.
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

let otpWorkerProcess: ReturnType<typeof spawn> | null = null;
let customerApiProcess: ReturnType<typeof spawn> | null = null;

const OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
const CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';

/**
 * Wait for a service to be ready
 */
async function waitForService(name: string, url: string, maxAttempts = 60): Promise<void> {
  console.log(`[Integration Setup] Waiting for ${name} at ${url}...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      // Any response (200, 401, 404) means the service is running
      console.log(`[Integration Setup] ✓ ${name} is ready`);
      return;
    } catch (error: any) {
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error(`[Integration Setup] ✗ ${name} failed to start: ${error.message}`);
      }
    }
  }
}

/**
 * Start a worker process using CI-compatible wrapper script
 */
function startWorker(name: string, workerDir: string, port: number): ReturnType<typeof spawn> {
  console.log(`[Integration Setup] Starting ${name} on port ${port}...`);
  
  const wrapperScript = resolve(rootDir, 'scripts', 'start-worker-with-health-check.js');
  
  // Verify the script exists before trying to use it
  if (!existsSync(wrapperScript)) {
    throw new Error(
      `[Integration Setup] Cannot find wrapper script at ${wrapperScript}\n` +
      `Root directory resolved to: ${rootDir}\n` +
      `Current working directory: ${process.cwd()}`
    );
  }
  
  const workerEnv = {
    ...process.env,
    CI: 'true',
    NO_INPUT: '1',
    E2E_TEST_JWT_TOKEN: process.env.E2E_TEST_JWT_TOKEN || 'dummy-token-for-integration-tests',
    NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
  };
  
  const proc = spawn('node', [wrapperScript, workerDir, String(port)], {
    stdio: 'pipe',
    shell: false,
    env: workerEnv,
    cwd: rootDir, // Ensure we're in the root directory context
  });
  
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready') || output.includes('healthy') || output.includes('error') || output.includes('Error')) {
      process.stdout.write(`[${name}] ${output}`);
    }
  });
  
  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });
  
  proc.on('error', (error) => {
    console.error(`[Integration Setup] Failed to start ${name}:`, error);
  });
  
  return proc;
}

/**
 * Cleanup function to kill worker processes
 */
function cleanup() {
  console.log('\n[Integration Setup] Cleaning up workers...');
  
  if (otpWorkerProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${otpWorkerProcess.pid}`, { stdio: 'ignore' });
      } else {
        process.kill(-otpWorkerProcess.pid, 'SIGTERM');
      }
      console.log('[Integration Setup] ✓ OTP Auth Service stopped');
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
      console.log('[Integration Setup] ✓ Customer API stopped');
    } catch (error) {
      // Process might already be dead, ignore
    }
  }
}

/**
 * Check if a service is already running
 */
async function isServiceRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });
    return true; // Any response means service is running
  } catch {
    return false;
  }
}

// Vitest globalSetup export
export async function setup() {
  // Check if integration test files exist - if they do, we might need workers
  const hasIntegrationTestFiles = 
    existsSync(join(__dirname, 'handlers/auth/customer-creation.integration.test.ts')) ||
    existsSync(join(__dirname, 'handlers/auth/otp-login-flow.integration.test.ts'));
  
  // Check if we're explicitly running integration tests or if integration test files exist
  // (if files exist, workers might be needed even if not explicitly running integration tests)
  const isIntegrationTest = 
    process.env.VITEST_INTEGRATION === 'true' ||
    process.argv.some(arg => arg.includes('integration')) ||
    process.argv.some(arg => arg.includes('customer-creation.integration') || arg.includes('otp-login-flow.integration'));
  
  // If integration test files exist and we're running tests, check if workers are needed
  // This ensures workers are available when running `pnpm test` which includes all tests
  if (!isIntegrationTest && !hasIntegrationTestFiles) {
    // Not running integration tests and no integration test files exist, skip worker startup
    return;
  }
  
  const OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
  const CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';
  
  // Check if services are already running
  const otpRunning = await isServiceRunning(`${OTP_AUTH_SERVICE_URL}/health`);
  const customerRunning = await isServiceRunning(`${CUSTOMER_API_URL}/customer/by-email/test@example.com`);
  
  if (otpRunning && customerRunning) {
    console.log('[Integration Setup] ✓ Services are already running, skipping startup');
    return;
  }
  
  console.log('[Integration Setup] Starting workers for integration tests...');
  
  // Start workers that aren't running
  if (!otpRunning) {
    otpWorkerProcess = startWorker('OTP Auth Service', 'serverless/otp-auth-service', 8787);
  }
  
  if (!customerRunning) {
    customerApiProcess = startWorker('Customer API', 'serverless/customer-api', 8790);
  }
  
  // Wait for services to be ready
  await Promise.all([
    otpRunning ? Promise.resolve() : waitForService('OTP Auth Service', `${OTP_AUTH_SERVICE_URL}/health`),
    customerRunning ? Promise.resolve() : waitForService('Customer API', `${CUSTOMER_API_URL}/customer/by-email/test@example.com`),
  ]);
  
  console.log('[Integration Setup] ✓ All services are ready!');
  // Give services a moment to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Vitest globalTeardown export
export async function teardown() {
  cleanup();
}
