/**
 * Multi-Worker Test Helper using Wrangler's unstable_dev
 * 
 * For integration tests that need multiple workers to communicate,
 * use wrangler's unstable_dev API which handles TypeScript compilation automatically.
 * 
 * This is simpler and faster than the old approach with process management.
 */

import { unstable_dev } from 'wrangler';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { UnstableDevWorker } from 'wrangler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// File is at: serverless/shared/test-helpers/miniflare-workers.ts
// __dirname = serverless/shared/test-helpers
// Going up 3 levels gets us to root: ../../..
const rootDir = resolve(__dirname, '../../..');

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
 * Get environment variables for a worker from .dev.vars or process.env
 */
function getWorkerEnv(workerDir: string): Record<string, string> {
  const devVarsPath = join(rootDir, workerDir, '.dev.vars');
  const env: Record<string, string> = {};
  
  // Common secrets that might be needed
  const secrets = [
    'JWT_SECRET',
    'NETWORK_INTEGRITY_KEYPHRASE',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'E2E_TEST_OTP_CODE',
    'ENVIRONMENT',
    'CUSTOMER_API_URL',
    'OTP_AUTH_SERVICE_URL'
  ];
  
  for (const secret of secrets) {
    // Prioritize process.env (for CI)
    if (process.env[secret]) {
      env[secret] = process.env[secret];
    } else {
      // Fallback to .dev.vars
      const value = readFromDevVars(devVarsPath, secret);
      if (value) {
        env[secret] = value;
      }
    }
  }
  
  // Set defaults for test environment
  if (!env.ENVIRONMENT) {
    env.ENVIRONMENT = 'test';
  }
  
  // Generate E2E_TEST_OTP_CODE if not set
  if (!env.E2E_TEST_OTP_CODE) {
    env.E2E_TEST_OTP_CODE = Math.floor(100000000 + Math.random() * 900000000).toString();
  }
  
  return env;
}

/**
 * Create both workers for multi-worker tests using Wrangler's unstable_dev
 * This handles TypeScript compilation automatically and provides a simpler API
 */
export async function createMultiWorkerSetup(): Promise<{
  otpAuthService: UnstableDevWorker;
  customerAPI: UnstableDevWorker;
  cleanup: () => Promise<void>;
}> {
  const customerApiPath = join(rootDir, 'serverless/customer-api');
  const otpAuthServicePath = join(rootDir, 'serverless/otp-auth-service');
  
  // Get environment variables for both workers
  const customerApiEnv = getWorkerEnv('serverless/customer-api');
  const otpAuthServiceEnv = getWorkerEnv('serverless/otp-auth-service');
  
  // Fixed ports for test workers (must match expected ports)
  const CUSTOMER_API_PORT = 8790;
  const OTP_AUTH_SERVICE_PORT = 8787;
  const customerApiUrl = `http://localhost:${CUSTOMER_API_PORT}`;
  
  console.log(`[Miniflare Helper] Starting Customer API worker on port ${CUSTOMER_API_PORT}...`);
  
  // Create Customer API worker using wrangler's unstable_dev
  // This handles TypeScript compilation automatically
  // CRITICAL: Use fixed port so OTP Auth Service can reach it
  const customerAPI = await unstable_dev(join(customerApiPath, 'worker.ts'), {
    config: join(customerApiPath, 'wrangler.toml'),
    local: true,
    port: CUSTOMER_API_PORT, // Fixed port for inter-worker communication
    vars: customerApiEnv,
    // Note: KV namespaces are configured in wrangler.toml
  });
  
  // Wait for customer API to be ready by making a health check
  // This ensures the worker is fully started before we use its URL
  let customerApiReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const healthCheck = await customerAPI.fetch('http://localhost/customer/by-email/test@example.com');
      customerApiReady = true;
      break;
    } catch (error) {
      if (i < 29) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  if (!customerApiReady) {
    console.warn('[Miniflare Helper] Customer API may not be ready, but continuing...');
  }
  
  console.log(`[Miniflare Helper] Customer API URL: ${customerApiUrl}`);
  console.log(`[Miniflare Helper] Customer API worker.url: ${customerAPI.url}`);
  console.log(`[Miniflare Helper] Starting OTP Auth Service worker on port ${OTP_AUTH_SERVICE_PORT}...`);
  console.log(`[Miniflare Helper] OTP Auth Service will use CUSTOMER_API_URL=${customerApiUrl}`);
  
  // Create OTP Auth Service worker
  // Set CUSTOMER_API_URL to point to the customer-api worker at fixed port
  const otpAuthService = await unstable_dev(join(otpAuthServicePath, 'worker.ts'), {
    config: join(otpAuthServicePath, 'wrangler.toml'),
    local: true,
    port: OTP_AUTH_SERVICE_PORT, // Fixed port for consistency
    vars: {
      ...otpAuthServiceEnv,
      CUSTOMER_API_URL: customerApiUrl, // Point to customer-api worker at fixed port
    },
    // Note: KV namespaces are configured in wrangler.toml
  });
  
  // Wait for OTP Auth Service to be ready
  let otpAuthServiceReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const healthCheck = await otpAuthService.fetch('http://localhost/health');
      otpAuthServiceReady = true;
      break;
    } catch (error) {
      if (i < 29) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  if (!otpAuthServiceReady) {
    console.warn('[Miniflare Helper] OTP Auth Service may not be ready, but continuing...');
  }
  
  console.log(`[Miniflare Helper] OTP Auth Service worker.url: ${otpAuthService.url}`);
  console.log(`[Miniflare Helper] ✓ Both workers started successfully`);
  
  return {
    otpAuthService,
    customerAPI,
    cleanup: async () => {
      await Promise.all([
        otpAuthService.stop(),
        customerAPI.stop()
      ]);
    }
  };
}
