/**
 * Multi-Worker Test Setup for Access Service Integration Tests
 * 
 * Creates Miniflare instances for:
 * - Access Service (port 8791)
 * - OTP Auth Service (port 8789)
 * - Customer API (port 8790)
 * 
 * Based on otp-auth-service/shared/test-helpers/miniflare-workers.ts
 */

import { Miniflare } from 'miniflare';
import { resolve } from 'path';
import type { UnstableDevWorker } from 'wrangler';

// Shared test secrets
const NETWORK_INTEGRITY_KEYPHRASE = 'test-integrity-keyphrase-for-integration-tests';
const JWT_SECRET = 'test-jwt-secret-for-local-development-12345678901234567890123456789012';
const SERVICE_API_KEY = 'test-service-key-12345';
const SUPER_ADMIN_API_KEY = 'test-super-admin-key';
const SUPER_ADMIN_EMAILS = 'm.seaward@pm.me';

export interface MultiWorkerSetup {
  accessService: UnstableDevWorker;
  otpAuthService: UnstableDevWorker;
  customerAPI: UnstableDevWorker;
  cleanup: () => Promise<void>;
}

/**
 * Create multi-worker setup for integration tests
 * 
 * Spins up:
 * - Access Service (localhost:8791)
 * - OTP Auth Service (localhost:8789)
 * - Customer API (localhost:8790)
 */
export async function createMultiWorkerSetup(): Promise<MultiWorkerSetup> {
  console.log('[MultiWorkerSetup] Starting Access Service worker...');
  
  // Access Service (port 8791) - Use compiled JavaScript
  const accessService = new Miniflare({
    scriptPath: resolve(__dirname, '../../dist/worker.js'), // Use compiled JavaScript
    modules: true,
    compatibilityDate: '2024-01-01',
    compatibilityFlags: ['nodejs_compat'],
    port: 8791,
    kvNamespaces: ['ACCESS_KV'],
    bindings: {
      SERVICE_API_KEY,
      ENVIRONMENT: 'test',
      NETWORK_INTEGRITY_KEYPHRASE,
    },
  }) as any; // Cast to UnstableDevWorker for compatibility

  console.log('[MultiWorkerSetup] Starting OTP Auth Service worker...');
  
  // OTP Auth Service (port 8789) - Use compiled JavaScript to avoid TypeScript parsing issues
  const otpAuthService = new Miniflare({
    scriptPath: resolve(__dirname, '../../../otp-auth-service/dist/worker.js'),
    modules: true,
    compatibilityDate: '2024-01-01',
    compatibilityFlags: ['nodejs_compat'],
    port: 8789,
    kvNamespaces: ['OTP_AUTH_KV'],
    bindings: {
      JWT_SECRET,
      ENVIRONMENT: 'development', // Local dev mode for email bypass
      CUSTOMER_API_URL: 'http://localhost:8790',
      ACCESS_SERVICE_URL: 'http://localhost:8791',
      NETWORK_INTEGRITY_KEYPHRASE,
      SUPER_ADMIN_EMAILS,
      SUPER_ADMIN_API_KEY,
    },
  }) as any;

  console.log('[MultiWorkerSetup] Starting Customer API worker...');
  
  // Customer API (port 8790) - Use compiled JavaScript to avoid TypeScript parsing issues
  const customerAPI = new Miniflare({
    scriptPath: resolve(__dirname, '../../../customer-api/dist/worker.js'),
    modules: true,
    compatibilityDate: '2024-01-01',
    compatibilityFlags: ['nodejs_compat'],
    port: 8790,
    kvNamespaces: ['CUSTOMER_KV'],
    bindings: {
      JWT_SECRET,
      ENVIRONMENT: 'development',
      NETWORK_INTEGRITY_KEYPHRASE,
    },
  }) as any;

  // Wait for all workers to be ready
  await Promise.all([
    accessService.ready,
    otpAuthService.ready,
    customerAPI.ready,
  ]);

  console.log('[MultiWorkerSetup] ✓ All workers ready!');

  return {
    accessService,
    otpAuthService,
    customerAPI,
    cleanup: async () => {
      console.log('[MultiWorkerSetup] Cleaning up workers...');
      await Promise.all([
        accessService.dispose?.(),
        otpAuthService.dispose?.(),
        customerAPI.dispose?.(),
      ]);
      console.log('[MultiWorkerSetup] ✓ Cleanup complete');
    },
  };
}
