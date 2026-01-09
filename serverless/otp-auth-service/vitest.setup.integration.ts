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
import { existsSync, writeFileSync, readFileSync } from 'fs';

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
async function waitForService(name: string, url: string, maxAttempts = 5): Promise<void> {
  console.log(`[Integration Setup] Waiting for ${name} at ${url}...`);
  
  // Try both localhost and 127.0.0.1
  const urls = [
    url,
    url.replace('localhost', '127.0.0.1'),
    url.replace('127.0.0.1', 'localhost')
  ];
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const testUrl of urls) {
      try {
        const response = await fetch(testUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        // Health endpoint requires JWT, so 401 is expected - but we need to verify it's a proper 401, not connection refused
        // A proper 401 means service is running and responding correctly
        if (response.status === 401) {
          // Verify it's a proper 401 response (service is running but needs auth)
          const responseText = await response.text();
          if (responseText.includes('JWT token') || responseText.includes('Unauthorized')) {
            console.log(`[Integration Setup] ✓ ${name} is ready (status: ${response.status} - service requires JWT)`);
            return;
          }
        } else if (response.status === 200) {
          // 200 means service is healthy and responded correctly
          console.log(`[Integration Setup] ✓ ${name} is ready (status: ${response.status})`);
          return;
        } else {
          // Other status codes - service is responding but may have issues
          console.log(`[Integration Setup] ⚠ ${name} is responding but returned status ${response.status}`);
          return;
        }
      } catch (error: any) {
        // Try next URL or wait and retry
        if (error.name === 'AbortError' || error.code === 'ECONNREFUSED') {
          // Connection refused or timeout - service not ready yet
          continue;
        }
        // Other errors might mean service is running but endpoint doesn't exist
        // That's OK - any response means service is up
        if (attempt > 5) {
          console.log(`[Integration Setup] ✓ ${name} appears to be running (got error: ${error.message})`);
          return;
        }
      }
    }
    
    if (attempt < maxAttempts - 1) {
      console.log(`[Integration Setup] Still waiting for ${name}... (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      throw new Error(`[Integration Setup] ✗ ${name} failed to start after ${maxAttempts} attempts. URL: ${url}`);
    }
  }
}

/**
 * Read a value from .dev.vars file
 */
function readFromDevVars(devVarsPath: string, key: string): string | null {
  if (!existsSync(devVarsPath)) {
    return null;
  }
  const content = readFileSync(devVarsPath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

/**
 * Get a secret value from process.env or .dev.vars
 * Prioritizes process.env for CI environments (GitHub Actions, etc.)
 * FAILS if not found in either (no fallbacks to live environments!)
 */
function getSecretValue(workerDir: string, secretName: string): string {
  // PRIORITIZE process.env first (for CI environments like GitHub Actions)
  const envValue = process.env[secretName];
  if (envValue) {
    return envValue;
  }
  
  // Fallback to .dev.vars for local development
  const devVarsPath = join(rootDir, workerDir, '.dev.vars');
  const devVarsValue = readFromDevVars(devVarsPath, secretName);
  if (devVarsValue) {
    return devVarsValue;
  }
  
  // FAIL - no fallback allowed
  throw new Error(
    `[Integration Setup] CRITICAL: Required secret ${secretName} is not set!\n` +
    `Tests must fail when required secrets are missing - no fallbacks allowed.\n` +
    `Set ${secretName} as an environment variable (for CI) or in ${workerDir}/.dev.vars (for local dev).`
  );
}

/**
 * Create .dev.vars file for a worker with required secrets
 * Reads from existing .dev.vars or process.env, FAILS if missing (no fallbacks!)
 */
function createDevVarsFile(workerDir: string, requiredSecrets: string[]): void {
  const devVarsPath = join(rootDir, workerDir, '.dev.vars');
  const secrets: Record<string, string> = {};
  
  // Get all required secrets - FAILS if any are missing
  for (const secretName of requiredSecrets) {
    secrets[secretName] = getSecretValue(workerDir, secretName);
  }
  
  // Write .dev.vars file
  const content = Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n';
  
  writeFileSync(devVarsPath, content, 'utf-8');
  console.log(`[Integration Setup] ✓ Created .dev.vars for ${workerDir}`);
}

/**
 * Start a worker process using CI-compatible wrapper script
 */
function startWorker(name: string, workerDir: string, port: number): ReturnType<typeof spawn> {
  console.log(`[Integration Setup] Starting ${name} on port ${port}...`);
  
  const wrapperScript = resolve(rootDir, 'scripts', 'start-worker-with-health-check.js');
  
  // Verify the script exists before trying to use it (should have been checked in setup, but double-check)
  if (!existsSync(wrapperScript)) {
    throw new Error(
      `[Integration Setup] Cannot find wrapper script at ${wrapperScript}\n` +
      `Root directory resolved to: ${rootDir}\n` +
      `Current working directory: ${process.cwd()}`
    );
  }
  
  // Create .dev.vars file with required secrets - FAILS if secrets are missing
  if (workerDir === 'serverless/otp-auth-service') {
    // E2E_TEST_OTP_CODE: Prioritize process.env (for CI/GitHub Actions), otherwise generate
    // This allows GitHub Actions to set E2E_TEST_OTP_CODE as a secret
    const testOtpCode = process.env.E2E_TEST_OTP_CODE || 
      Math.floor(100000000 + Math.random() * 900000000).toString();
    
    const otpSource = process.env.E2E_TEST_OTP_CODE ? 'process.env (CI)' : 'generated';
    
    // Also set in process.env so tests can access it
    process.env.E2E_TEST_OTP_CODE = testOtpCode;
    
    // Create .dev.vars with all required secrets including E2E_TEST_OTP_CODE
    // All secrets prioritize process.env first (for CI), then fallback to .dev.vars (for local)
    const devVarsPath = join(rootDir, workerDir, '.dev.vars');
    const secrets: Record<string, string> = {};
    
    // Get required secrets (prioritizes process.env, then .dev.vars)
    for (const secretName of ['JWT_SECRET', 'NETWORK_INTEGRITY_KEYPHRASE', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL']) {
      secrets[secretName] = getSecretValue(workerDir, secretName);
    }
    
    // Add E2E_TEST_OTP_CODE and ENVIRONMENT
    secrets['E2E_TEST_OTP_CODE'] = testOtpCode;
    secrets['ENVIRONMENT'] = 'test';
    
    // Write .dev.vars file with all values (for workers to read)
    const content = Object.entries(secrets)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n';
    
    writeFileSync(devVarsPath, content, 'utf-8');
    console.log(`[Integration Setup] ✓ Created .dev.vars for ${workerDir} with E2E_TEST_OTP_CODE=${testOtpCode} (${otpSource})`);
  } else if (workerDir === 'serverless/customer-api') {
    createDevVarsFile(workerDir, [
      'JWT_SECRET',
      'NETWORK_INTEGRITY_KEYPHRASE'
    ]);
  }
  
  const workerEnv = {
    ...process.env,
    CI: 'true',
    NO_INPUT: '1',
    E2E_TEST_JWT_TOKEN: process.env.E2E_TEST_JWT_TOKEN || 'dummy-token-for-integration-tests',
  };
  
  // Validate NETWORK_INTEGRITY_KEYPHRASE is set (check both process.env and .dev.vars)
  // This validation happens before getSecretValue is called, so we check both sources
  const networkIntegrityKeyphrase = process.env.NETWORK_INTEGRITY_KEYPHRASE || 
    (workerDir === 'serverless/otp-auth-service' || workerDir === 'serverless/customer-api' 
      ? readFromDevVars(join(rootDir, workerDir, '.dev.vars'), 'NETWORK_INTEGRITY_KEYPHRASE')
      : null);
  
  if (!networkIntegrityKeyphrase) {
    throw new Error(
      '[Integration Setup] CRITICAL: NETWORK_INTEGRITY_KEYPHRASE is required!\n' +
      'Tests must fail when required secrets are missing - no fallbacks allowed.\n' +
      'Set NETWORK_INTEGRITY_KEYPHRASE as an environment variable (for CI) or in .dev.vars (for local dev).'
    );
  }
  
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
    const pid = otpWorkerProcess.pid;
    if (pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } else {
          process.kill(-pid, 'SIGTERM');
        }
        console.log('[Integration Setup] ✓ OTP Auth Service stopped');
      } catch (error) {
        // Process might already be dead, ignore
      }
    }
  }
  
  if (customerApiProcess) {
    const pid = customerApiProcess.pid;
    if (pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        } else {
          process.kill(-pid, 'SIGTERM');
        }
        console.log('[Integration Setup] ✓ Customer API stopped');
      } catch (error) {
        // Process might already be dead, ignore
      }
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
  // Early exit: Check if we're explicitly running integration tests
  const isIntegrationTest = 
    process.env.VITEST_INTEGRATION === 'true' ||
    process.argv.some(arg => arg.includes('integration')) ||
    process.argv.some(arg => 
      arg.includes('customer-creation.integration') || 
      arg.includes('otp-login-flow.integration') ||
      arg.includes('api-key.integration')
    );
  
  // Check if integration test files exist
  const hasIntegrationTestFiles = 
    existsSync(join(__dirname, 'handlers/auth/customer-creation.integration.test.ts')) ||
    existsSync(join(__dirname, 'handlers/auth/otp-login-flow.integration.test.ts')) ||
    existsSync(join(__dirname, 'handlers/auth/api-key.integration.test.ts'));
  
  // If not running integration tests and no integration test files exist, skip entirely
  if (!isIntegrationTest && !hasIntegrationTestFiles) {
    // Not running integration tests and no integration test files exist, skip worker startup
    return;
  }
  
  // Verify wrapper script exists before proceeding (only if we need workers)
  const wrapperScript = resolve(rootDir, 'scripts', 'start-worker-with-health-check.js');
  if (!existsSync(wrapperScript)) {
    // If we don't have the script but also don't have integration tests, just skip
    if (!hasIntegrationTestFiles && !isIntegrationTest) {
      return;
    }
    // Otherwise, this is an error
    throw new Error(
      `[Integration Setup] Cannot find wrapper script at ${wrapperScript}\n` +
      `Root directory resolved to: ${rootDir}\n` +
      `Current working directory: ${process.cwd()}\n` +
      `Integration test files exist: ${hasIntegrationTestFiles}\n` +
      `Is integration test: ${isIntegrationTest}`
    );
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
  // Give wrapper scripts time to start wrangler and do their own health checks (they check with JWT)
  console.log('[Integration Setup] Waiting for wrapper scripts to start workers...');
  await new Promise(resolve => setTimeout(resolve, 5000)); // Give wrangler time to start
  
  await Promise.all([
    otpRunning ? Promise.resolve() : waitForService('OTP Auth Service', `${OTP_AUTH_SERVICE_URL}/health`),
    customerRunning ? Promise.resolve() : waitForService('Customer API', `${CUSTOMER_API_URL}/customer/by-email/test@example.com`),
  ]);
  
  console.log('[Integration Setup] ✓ All services are ready!');
  // Give services a moment to fully initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
}

// Vitest globalTeardown export
export async function teardown() {
  cleanup();
}
