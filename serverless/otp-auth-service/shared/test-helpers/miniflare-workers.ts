/**
 * Miniflare Multi-Worker Setup for Integration Tests
 * 
 * This helper provides a fast, programmatic way to spin up multiple Cloudflare Workers
 * for integration testing using Miniflare.
 * 
 * Benefits over wrangler dev processes:
 * - Instant startup (2-5 seconds vs 60-120 seconds)
 * - No health checks needed
 * - No process management complexity
 * - Proper cleanup
 */

import { unstable_dev, type UnstableDevWorker } from 'wrangler';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths to worker entry points
const OTP_AUTH_SERVICE_DIR = join(__dirname, '..', '..');
const CUSTOMER_API_DIR = join(__dirname, '..', '..', '..', 'customer-api');

// Service URLs (Miniflare assigns these automatically)
const OTP_AUTH_SERVICE_URL = 'http://localhost:8787';
const CUSTOMER_API_URL = 'http://localhost:8790';

/**
 * Setup return type
 */
export interface MultiWorkerSetup {
  otpAuthService: UnstableDevWorker;
  customerAPI: UnstableDevWorker;
  cleanup: () => Promise<void>;
}

/**
 * Create and start both OTP Auth Service and Customer API workers using Miniflare
 * 
 * @returns Promise with both workers and cleanup function
 */
export async function createMultiWorkerSetup(): Promise<MultiWorkerSetup> {
  console.log('[Miniflare Setup] Starting workers...');
  
  try {
    // Prepare environment variables for workers
    // E2E_TEST_OTP_CODE: Prioritize process.env (for CI/GitHub Actions), otherwise generate
    const testOtpCode = process.env.E2E_TEST_OTP_CODE || 
      Math.floor(100000000 + Math.random() * 900000000).toString();
    const otpSource = process.env.E2E_TEST_OTP_CODE ? 'process.env (CI)' : 'generated';
    
    // Also set in process.env so tests can access it
    process.env.E2E_TEST_OTP_CODE = testOtpCode;
    
    console.log(`[Miniflare Setup] Using E2E_TEST_OTP_CODE=${testOtpCode} (${otpSource})`);
    
    // Prepare environment bindings for OTP Auth Service
    const otpAuthEnv = {
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests',
      NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
      RESEND_API_KEY: process.env.RESEND_API_KEY || 're_test_miniflare_integration_tests', // Use test key if not set
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'test@example.com',
      E2E_TEST_OTP_CODE: testOtpCode,
      ENVIRONMENT: 'test',
      CUSTOMER_API_URL: CUSTOMER_API_URL,
      SUPER_ADMIN_API_KEY: process.env.SUPER_ADMIN_API_KEY || 'test-super-admin-key',
    };
    
    // Prepare environment bindings for Customer API
    const customerApiEnv = {
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests',
      NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
      SUPER_ADMIN_API_KEY: process.env.SUPER_ADMIN_API_KEY || 'test-super-admin-key',
    };
    
    // Start Customer API worker (port 8790)
    console.log('[Miniflare Setup] Starting Customer API worker...');
    const customerAPI = await unstable_dev(join(CUSTOMER_API_DIR, 'worker.ts'), {
      config: join(CUSTOMER_API_DIR, 'wrangler.toml'),
      experimental: { disableExperimentalWarning: true },
      port: 8790,
      local: true,
      vars: customerApiEnv,
    });
    
    // Start OTP Auth Service worker (port 8787)
    console.log('[Miniflare Setup] Starting OTP Auth Service worker...');
    const otpAuthService = await unstable_dev(join(OTP_AUTH_SERVICE_DIR, 'worker.ts'), {
      config: join(OTP_AUTH_SERVICE_DIR, 'wrangler.toml'),
      experimental: { disableExperimentalWarning: true },
      port: 8787,
      local: true,
      vars: otpAuthEnv,
    });
    
    console.log(`[Miniflare Setup] ✓ Workers started successfully`);
    console.log(`[Miniflare Setup]   - OTP Auth Service: ${OTP_AUTH_SERVICE_URL}`);
    console.log(`[Miniflare Setup]   - Customer API: ${CUSTOMER_API_URL}`);
    
    // Cleanup function
    const cleanup = async () => {
      console.log('[Miniflare Setup] Stopping workers...');
      await Promise.all([
        otpAuthService.stop(),
        customerAPI.stop(),
      ]);
      console.log('[Miniflare Setup] ✓ Workers stopped');
    };
    
    return {
      otpAuthService,
      customerAPI,
      cleanup,
    };
  } catch (error) {
    console.error('[Miniflare Setup] ✗ Failed to start workers:', error);
    throw error;
  }
}
