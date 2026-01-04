/**
 * Shared Vitest Global Setup for ALL Integration Tests
 * 
 * This setup file automatically starts required workers for ANY integration test
 * that matches the pattern: *.integration.test.ts
 * 
 * Features:
 * - Detects integration tests automatically by file pattern
 * - Reuses workers across test suites (singleton pattern)
 * - Starts OTP Auth Service (port 8787) and Customer API (port 8790)
 * - Waits for services to be ready before tests run
 * - Cleans up workers only after all tests complete
 * 
 * Usage:
 * - Add to vitest.config.ts: globalSetup: '../shared/vitest.setup.integration.ts'
 * - Works for any service (otp-auth-service, mods-api, etc.)
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

// Singleton pattern: Track if workers are already started
let otpWorkerProcess: ReturnType<typeof spawn> | null = null;
let customerApiProcess: ReturnType<typeof spawn> | null = null;
let otpBuildErrorPromise: Promise<void> | null = null;
let customerBuildErrorPromise: Promise<void> | null = null;
let workersStarted = false;

const OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
const CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';

/**
 * Check if we're running integration tests
 * Detects by:
 * 1. VITEST_INTEGRATION env var
 * 2. Command line args containing "integration"
 * 3. Test file pattern matching *.integration.test.ts
 */
function isRunningIntegrationTests(): boolean {
  // Check environment variable
  if (process.env.VITEST_INTEGRATION === 'true') {
    return true;
  }
  
  // Check command line arguments
  if (process.argv.some(arg => arg.includes('integration'))) {
    return true;
  }
  
  // Check if any integration test files are being run
  // Vitest passes test file paths in process.argv
  if (process.argv.some(arg => arg.includes('.integration.test.'))) {
    return true;
  }
  
  return false;
}

/**
 * Wait for a service to be ready
 * For OTP Auth Service, also verifies KV is accessible by testing a simple operation
 */
async function waitForService(name: string, url: string, maxAttempts = 5): Promise<void> {
  console.log(`[Integration Setup] Waiting for ${name} at ${url}...`);
  
  // Try both localhost and 127.0.0.1 (Windows networking quirk)
  const urls = [
    url,
    url.replace('localhost', '127.0.0.1'),
    url.replace('127.0.0.1', 'localhost')
  ];
  
  let serviceResponding = false;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (const testUrl of urls) {
      try {
        const response = await fetch(testUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        // Health endpoint requires JWT, so 401 is expected - but we need to verify it's a proper 401, not connection refused
        // A proper 401 means service is running and responding correctly
        // Connection refused would throw an error, not return 401
        if (response.status === 401) {
          // Verify it's a proper 401 response (service is running but needs auth)
          const responseText = await response.text();
          if (responseText.includes('JWT token') || responseText.includes('Unauthorized')) {
            serviceResponding = true;
            console.log(`[Integration Setup] ✓ ${name} is responding (status: ${response.status} - service requires JWT)`);
            break;
          }
        } else if (response.status === 200) {
          // 200 means service is healthy and responded correctly
          serviceResponding = true;
          console.log(`[Integration Setup] ✓ ${name} is healthy (status: ${response.status})`);
          break;
        } else {
          // Other status codes - service is responding but may have issues
          serviceResponding = true;
          console.log(`[Integration Setup] ⚠ ${name} is responding but returned status ${response.status}`);
          break;
        }
      } catch (error: any) {
        // Fetch failed - service is NOT running
        // Do NOT treat this as "service is running" - it's a connection failure
        if (error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
          // Connection refused or timeout - service not ready yet
          // Continue to next URL or wait and retry
          continue;
        }
        // Other unexpected errors - log but don't treat as "running"
        console.log(`[Integration Setup] ${name} connection error: ${error.message}`);
        continue;
      }
    }
    
    if (serviceResponding) {
      // For OTP Auth Service, verify KV is accessible by testing a health check that uses KV
      if (name === 'OTP Auth Service') {
        // Wait a bit more for KV to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try a simple request that would use KV (like /health or /signup)
        // Health endpoint requires JWT, so 401 is expected - verify it's a proper 401 response
        try {
          const kvTestUrl = url.includes('/health') 
            ? url 
            : url.replace('/customer/by-email/test@example.com', '/health');
          const kvTestResponse = await fetch(kvTestUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          // Health endpoint requires JWT, so 401 is expected - verify it's a proper 401 (not connection refused)
          if (kvTestResponse.status === 401) {
            const responseText = await kvTestResponse.text();
            if (responseText.includes('JWT token') || responseText.includes('Unauthorized')) {
              // Proper 401 means service is running and KV is accessible
              console.log(`[Integration Setup] ✓ ${name} KV is ready (health check returned 401 - service requires JWT)`);
              return;
            }
          } else if (kvTestResponse.status === 200) {
            // 200 means service is fully healthy
            console.log(`[Integration Setup] ✓ ${name} KV is ready (health check returned 200)`);
            return;
          }
          // If we get here, KV test didn't pass - service might not be fully ready
          console.log(`[Integration Setup] ⚠ ${name} responded but KV test returned unexpected status: ${kvTestResponse.status}`);
          // Still consider it ready if we got a response (even if unexpected)
          return;
        } catch (kvError: any) {
          // KV test failed - service might not be fully ready
          console.log(`[Integration Setup] ⚠ ${name} KV test failed: ${kvError.message}`);
          // If we got a response earlier, consider it ready (KV might just need more time)
          // But log the warning
          return;
        }
      } else {
        // For other services, if we got a response, we're done
        return;
      }
    }
    
    // Wait before next attempt
    if (!serviceResponding) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[Integration Setup] Still waiting for ${name}... (attempt ${attempt + 1}/${maxAttempts})`);
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
 * Returns process and a promise that rejects if build fails
 */
function startWorker(name: string, workerDir: string, port: number): {
  proc: ReturnType<typeof spawn>;
  buildErrorPromise: Promise<void>;
} {
  console.log(`[Integration Setup] Starting ${name} on port ${port}...`);
  
  const wrapperScript = resolve(rootDir, 'scripts', 'start-worker-with-health-check.js');
  
  // Verify the script exists
  if (!existsSync(wrapperScript)) {
    throw new Error(
      `[Integration Setup] Cannot find wrapper script at ${wrapperScript}\n` +
      `Root directory resolved to: ${rootDir}\n` +
      `Current working directory: ${process.cwd()}`
    );
  }
  
  // Create .dev.vars file with required secrets
  if (workerDir === 'serverless/otp-auth-service') {
    // E2E_TEST_OTP_CODE: Prioritize process.env (for CI/GitHub Actions), otherwise generate
    const testOtpCode = process.env.E2E_TEST_OTP_CODE || 
      Math.floor(100000000 + Math.random() * 900000000).toString();
    
    const otpSource = process.env.E2E_TEST_OTP_CODE ? 'process.env (CI)' : 'generated';
    
    // Also set in process.env so tests can access it
    process.env.E2E_TEST_OTP_CODE = testOtpCode;
    
    // Create .dev.vars with all required secrets
    const devVarsPath = join(rootDir, workerDir, '.dev.vars');
    const secrets: Record<string, string> = {};
    
    // Get required secrets (prioritizes process.env, then .dev.vars)
    for (const secretName of ['JWT_SECRET', 'NETWORK_INTEGRITY_KEYPHRASE', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL']) {
      try {
        secrets[secretName] = getSecretValue(workerDir, secretName);
      } catch (error) {
        // For test environment, use defaults if not set
        if (secretName === 'RESEND_API_KEY' || secretName === 'RESEND_FROM_EMAIL') {
          secrets[secretName] = process.env[secretName] || 'test-value';
        } else {
          throw error;
        }
      }
    }
    
    // Add E2E_TEST_OTP_CODE and ENVIRONMENT
    secrets['E2E_TEST_OTP_CODE'] = testOtpCode;
    secrets['ENVIRONMENT'] = 'test';
    
    // Write .dev.vars file
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
  
  // Validate NETWORK_INTEGRITY_KEYPHRASE is set
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
    cwd: rootDir,
  });
  
  // Track build errors and process exit
  let buildError: Error | null = null;
  let buildErrorResolve: (() => void) | null = null;
  let buildErrorReject: ((error: Error) => void) | null = null;
  const buildErrorPromise = new Promise<void>((resolve, reject) => {
    buildErrorResolve = resolve;
    buildErrorReject = reject;
  });
  
  // Collect output to detect build errors
  let stdoutBuffer = '';
  let stderrBuffer = '';
  
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    stdoutBuffer += output;
    
    // Check for build errors in output
    if (output.includes('[ERROR]') || 
        output.includes('Build failed') || 
        output.includes('X [ERROR]') ||
        output.match(/Cannot use ["']continue["']/i) ||
        output.match(/SyntaxError/i) ||
        output.match(/TypeError/i)) {
      buildError = new Error(
        `[Integration Setup] ✗ ${name} build failed!\n` +
        `Build error detected in output:\n${output}\n` +
        `Full stdout:\n${stdoutBuffer}\n` +
        `Full stderr:\n${stderrBuffer}`
      );
      if (buildErrorReject) {
        buildErrorReject(buildError);
      }
      return; // Don't process further if build error detected
    }
    
    // If we see "Ready", the build succeeded - resolve the promise
    if (output.includes('Ready on http://') && buildErrorResolve && !buildError) {
      buildErrorResolve();
    }
    
    // Always show important output
    if (output.includes('Ready') || output.includes('healthy') || output.includes('error') || output.includes('Error') || output.includes('[ERROR]')) {
      process.stdout.write(`[${name}] ${output}`);
    }
  });
  
  proc.stderr.on('data', (data) => {
    const output = data.toString();
    stderrBuffer += output;
    process.stderr.write(`[${name}] ${output}`);
    
    // Check for build errors in stderr
    if (output.includes('[ERROR]') || 
        output.includes('Build failed') || 
        output.includes('X [ERROR]') ||
        output.match(/Cannot use ["']continue["']/i) ||
        output.match(/SyntaxError/i) ||
        output.match(/TypeError/i)) {
      buildError = new Error(
        `[Integration Setup] ✗ ${name} build failed!\n` +
        `Build error detected in stderr:\n${output}\n` +
        `Full stdout:\n${stdoutBuffer}\n` +
        `Full stderr:\n${stderrBuffer}`
      );
      if (buildErrorReject) {
        buildErrorReject(buildError);
      }
    }
  });
  
  proc.on('error', (error) => {
    const procError = new Error(
      `[Integration Setup] ✗ Failed to start ${name} process: ${error.message}\n` +
      `Full stdout:\n${stdoutBuffer}\n` +
      `Full stderr:\n${stderrBuffer}`
    );
    if (buildErrorReject) {
      buildErrorReject(procError);
    }
  });
  
  // Monitor process exit - if it exits with non-zero code, it's a failure
  proc.on('exit', (code, signal) => {
    // Only fail if process exits early (before health check completes)
    // If code is non-zero and we haven't seen a "Ready" message, it's a build failure
    if (code !== 0 && code !== null && !stdoutBuffer.includes('Ready')) {
      const exitError = new Error(
        `[Integration Setup] ✗ ${name} process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}\n` +
        `This usually indicates a build failure.\n` +
        `Full stdout:\n${stdoutBuffer}\n` +
        `Full stderr:\n${stderrBuffer}`
      );
      if (buildErrorReject && !buildError) {
        buildErrorReject(exitError);
      }
    }
  });
  
  return { proc, buildErrorPromise };
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

/**
 * Cleanup function to kill worker processes
 * Only called during teardown, not between test suites
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
  
  // Reset singleton state
  workersStarted = false;
  otpWorkerProcess = null;
  customerApiProcess = null;
  otpBuildErrorPromise = null;
  customerBuildErrorPromise = null;
}

// Vitest globalSetup export
export async function setup() {
  // Check if we're running integration tests
  if (!isRunningIntegrationTests()) {
    // Not running integration tests, skip worker startup
    return;
  }
  
  // Singleton pattern: If workers are already started, skip
  if (workersStarted) {
    console.log('[Integration Setup] ✓ Workers already started, reusing existing workers');
    return;
  }
  
  // Verify wrapper script exists
  const wrapperScript = resolve(rootDir, 'scripts', 'start-worker-with-health-check.js');
  if (!existsSync(wrapperScript)) {
    throw new Error(
      `[Integration Setup] Cannot find wrapper script at ${wrapperScript}\n` +
      `Root directory resolved to: ${rootDir}\n` +
      `Current working directory: ${process.cwd()}`
    );
  }
  
  // Check if services are already running (from previous test run or manual start)
  const otpRunning = await isServiceRunning(`${OTP_AUTH_SERVICE_URL}/health`);
  const customerRunning = await isServiceRunning(`${CUSTOMER_API_URL}/customer/by-email/test@example.com`);
  
  if (otpRunning && customerRunning) {
    console.log('[Integration Setup] ✓ Services are already running, skipping startup');
    workersStarted = true;
    return;
  }
  
  console.log('[Integration Setup] Starting workers for integration tests...');
  
  // Start workers that aren't running
  if (!otpRunning) {
    const otpWorker = startWorker('OTP Auth Service', 'serverless/otp-auth-service', 8787);
    otpWorkerProcess = otpWorker.proc;
    otpBuildErrorPromise = otpWorker.buildErrorPromise;
  }
  
  if (!customerRunning) {
    const customerWorker = startWorker('Customer API', 'serverless/customer-api', 8790);
    customerApiProcess = customerWorker.proc;
    customerBuildErrorPromise = customerWorker.buildErrorPromise;
  }
  
  // Monitor for build errors - if build fails, we want to fail fast
  console.log('[Integration Setup] Waiting for wrapper scripts to start workers...');
  
  // Give wrangler time to start (5 seconds), but monitor for build errors during this time
  // If a build error is detected, it will throw immediately via the promise rejection
  const startupDelay = new Promise(resolve => setTimeout(resolve, 5000));
  
  // Race startup delay against build error promises
  // If build error occurs, it will reject and throw immediately
  const buildErrorChecks: Promise<any>[] = [];
  
  if (otpBuildErrorPromise) {
    buildErrorChecks.push(
      otpBuildErrorPromise.catch((error) => {
        throw new Error(
          `[Integration Setup] ✗ OTP Auth Service build failed - tests cannot continue!\n` +
          `${error.message}\n` +
          `\nFix the build error before running tests.`
        );
      })
    );
  }
  
  if (customerBuildErrorPromise) {
    buildErrorChecks.push(
      customerBuildErrorPromise.catch((error) => {
        throw new Error(
          `[Integration Setup] ✗ Customer API build failed - tests cannot continue!\n` +
          `${error.message}\n` +
          `\nFix the build error before running tests.`
        );
      })
    );
  }
  
  // Race: if build error occurs, it will reject and throw immediately
  // Otherwise, wait for startup delay
  await Promise.race([
    startupDelay,
    ...buildErrorChecks
  ]).catch((error) => {
    // Build error detected - fail fast
    throw error;
  });
  
  // Now wait for health checks, but continue monitoring for build errors
  // If build error occurs during health check, it will still fail fast
  const healthCheckPromises: Promise<void>[] = [];
  
  if (!otpRunning) {
    healthCheckPromises.push(
      Promise.race([
        waitForService('OTP Auth Service', `${OTP_AUTH_SERVICE_URL}/health`),
        otpBuildErrorPromise?.catch((error) => {
          throw new Error(
            `[Integration Setup] ✗ OTP Auth Service build failed during health check!\n` +
            `${error.message}`
          );
        }) || Promise.resolve()
      ])
    );
  }
  
  if (!customerRunning) {
    healthCheckPromises.push(
      Promise.race([
        waitForService('Customer API', `${CUSTOMER_API_URL}/customer/by-email/test@example.com`),
        customerBuildErrorPromise?.catch((error) => {
          throw new Error(
            `[Integration Setup] ✗ Customer API build failed during health check!\n` +
            `${error.message}`
          );
        }) || Promise.resolve()
      ])
    );
  }
  
  await Promise.all(healthCheckPromises).catch((error) => {
    // Build error or health check failure - fail fast
    throw error;
  });
  
  console.log('[Integration Setup] ✓ All services are ready!');
  
  // Mark workers as started (singleton pattern)
  workersStarted = true;
  
  // Give services additional time to fully initialize (KV, routing, etc.)
  // This is especially important for Cloudflare Workers which may need time
  // to initialize KV namespaces and other bindings
  console.log('[Integration Setup] Waiting for services to fully initialize (KV, routing, etc.)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('[Integration Setup] ✓ Services fully initialized and ready for tests');
}

// Vitest globalTeardown export
// Only called once after ALL tests complete
export async function teardown() {
  // Only cleanup if we started the workers
  if (workersStarted) {
    cleanup();
  }
}
