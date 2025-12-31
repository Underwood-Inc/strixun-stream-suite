import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load .dev.vars files into process.env for E2E tests
 * Returns the encryption key from OTP Auth Service for use in mods-hub
 * Priority: SERVICE_ENCRYPTION_KEY (worker key) > VITE_SERVICE_ENCRYPTION_KEY (frontend key)
 */
function loadDevVars(): string | undefined {
  const devVarsPaths = [
    join(__dirname, 'serverless', 'mods-api', '.dev.vars'),
    join(__dirname, 'serverless', 'otp-auth-service', '.dev.vars'),
  ];
  
  let serviceEncryptionKey: string | undefined;
  let viteServiceEncryptionKey: string | undefined;
  
  for (const devVarsPath of devVarsPaths) {
    if (existsSync(devVarsPath)) {
      const content = readFileSync(devVarsPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          // Only set if not already in process.env (env vars take precedence)
          if (!process.env[key]) {
            process.env[key] = value;
          }
          
          // Extract encryption keys from OTP Auth Service .dev.vars
          if (devVarsPath.includes('otp-auth-service')) {
            if (key === 'SERVICE_ENCRYPTION_KEY') {
              serviceEncryptionKey = value;
            } else if (key === 'VITE_SERVICE_ENCRYPTION_KEY') {
              viteServiceEncryptionKey = value;
            }
          }
        }
      }
    }
  }
  
  // Priority: SERVICE_ENCRYPTION_KEY (worker uses this) > VITE_SERVICE_ENCRYPTION_KEY
  // Both should match, but SERVICE_ENCRYPTION_KEY is what the worker actually uses
  return serviceEncryptionKey || viteServiceEncryptionKey;
}

// Load .dev.vars before tests run
loadDevVars();

/**
 * Playwright E2E Test Configuration
 * 
 * E2E tests run ONLY against local workers (wrangler dev).
 * This ensures complete isolation from production and development deployments.
 * 
 * Setup:
 * 1. Run tests: pnpm test:e2e
 * 2. Local workers start automatically on ports 8787+
 */

// ============================================================================
// E2E TEST CONFIGURATION - LOCAL WORKERS ONLY
// ============================================================================
// E2E tests ONLY use local workers (wrangler dev) - NO deployed workers
// This ensures complete isolation from production and development deployments
// ============================================================================

const BASE_PORT = parseInt(process.env.E2E_LOCAL_WORKER_PORT || '8787', 10);

// All workers run locally on sequential ports starting from BASE_PORT
const WORKER_URLS = {
  OTP_AUTH: process.env.E2E_OTP_AUTH_URL || `http://localhost:${BASE_PORT}`,
  MODS_API: process.env.E2E_MODS_API_URL || `http://localhost:${BASE_PORT + 1}`,
  TWITCH_API: process.env.E2E_TWITCH_API_URL || `http://localhost:${BASE_PORT + 2}`,
  CUSTOMER_API: process.env.E2E_CUSTOMER_API_URL || `http://localhost:${BASE_PORT + 3}`,
  GAME_API: process.env.E2E_GAME_API_URL || `http://localhost:${BASE_PORT + 4}`,
  CHAT_SIGNALING: process.env.E2E_CHAT_SIGNALING_URL || `http://localhost:${BASE_PORT + 5}`,
  URL_SHORTENER: process.env.E2E_URL_SHORTENER_URL || `http://localhost:${BASE_PORT + 6}`,
  FRONTEND: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
  MODS_HUB: process.env.E2E_MODS_HUB_URL || 'http://localhost:3001',
};

// Load .dev.vars before config is evaluated (so we can pass to workers)
// Get encryption key for mods-hub (must match OTP Auth Service)
const E2E_ENCRYPTION_KEY = loadDevVars() || 
  process.env.SERVICE_ENCRYPTION_KEY || 
  process.env.VITE_SERVICE_ENCRYPTION_KEY || 
  'test-service-encryption-key-for-local-development-12345678901234567890123456789012';

export default defineConfig({
  // Global setup to load .dev.vars before tests run
  globalSetup: './playwright.global-setup.ts',
  // E2E tests are co-located with the code they test
  // Pattern: **/*.e2e.spec.ts or **/*.e2e.test.ts
  testMatch: /.*\.e2e\.(spec|test)\.(ts|js)/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use multiple workers to better replicate production conditions
  // CI uses fewer workers for stability, local uses more for speed
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['list'],
  ],
  use: {
    baseURL: WORKER_URLS.FRONTEND,
    // Disable recordings until all tests pass
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    // Pass E2E test credentials from .dev.vars to test workers
    // These are loaded by loadDevVars() above
    env: {
      ...(process.env.E2E_TEST_JWT_TOKEN ? { E2E_TEST_JWT_TOKEN: process.env.E2E_TEST_JWT_TOKEN } : {}),
      ...(process.env.E2E_TEST_OTP_CODE ? { E2E_TEST_OTP_CODE: process.env.E2E_TEST_OTP_CODE } : {}),
      ...(process.env.E2E_TEST_EMAIL ? { E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL } : {}),
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev servers before starting the tests
  webServer: [
    {
      command: 'pnpm dev',
      url: WORKER_URLS.FRONTEND,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000, // 60 seconds to start frontend
      env: {
        // Override API URL and encryption key for E2E tests (same as mods-hub)
        // This ensures the main app uses local worker URLs and matching encryption keys
        VITE_AUTH_API_URL: WORKER_URLS.OTP_AUTH,
        VITE_SERVICE_ENCRYPTION_KEY: E2E_ENCRYPTION_KEY,
      },
    },
    {
      command: 'cd mods-hub && pnpm dev',
      url: WORKER_URLS.MODS_HUB,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000, // 60 seconds to start mods-hub
      env: {
        // Override Vite proxy URLs with direct local worker URLs for E2E tests
        VITE_AUTH_API_URL: WORKER_URLS.OTP_AUTH,
        VITE_MODS_API_URL: WORKER_URLS.MODS_API,
        // Use the same encryption key as OTP Auth Service (must match SERVICE_ENCRYPTION_KEY)
        // This ensures mods-hub encrypts requests with the same key the worker expects
        VITE_SERVICE_ENCRYPTION_KEY: E2E_ENCRYPTION_KEY,
      },
    },
    // Start all local workers (E2E tests replicate production with all services running)
    // Each service runs on its own port to replicate production deployment
    ...(process.env.E2E_START_LOCAL_WORKER !== 'false' ? [
      // OTP Auth Service (port 8787)
      // --local flag ensures .dev.vars is used (not Cloudflare secrets)
      // This matches the deployment pattern where .dev.vars is the source for local testing
      {
        command: process.platform === 'win32' 
          ? `cd serverless/otp-auth-service && set CI=true && set NO_INPUT=1 && pnpm setup:test-secrets && wrangler dev --port ${BASE_PORT} --local`
          : `cd serverless/otp-auth-service && CI=true NO_INPUT=1 pnpm setup:test-secrets && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT} --local`,
        url: `${WORKER_URLS.OTP_AUTH}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Mods API (port 8788)
      {
        command: process.platform === 'win32'
          ? `cd serverless/mods-api && set CI=true && set NO_INPUT=1 && pnpm setup:test-secrets && wrangler dev --port ${BASE_PORT + 1} --local`
          : `cd serverless/mods-api && CI=true NO_INPUT=1 pnpm setup:test-secrets && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 1} --local`,
        url: `${WORKER_URLS.MODS_API}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Twitch API (port 8789)
      {
        command: process.platform === 'win32'
          ? `cd serverless/twitch-api && set CI=true && set NO_INPUT=1 && wrangler dev --port ${BASE_PORT + 2} --local`
          : `cd serverless/twitch-api && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 2} --local`,
        url: `${WORKER_URLS.TWITCH_API}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Customer API (port 8790)
      {
        command: process.platform === 'win32'
          ? `cd serverless/customer-api && set CI=true && set NO_INPUT=1 && wrangler dev --port ${BASE_PORT + 3} --local`
          : `cd serverless/customer-api && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 3} --local`,
        url: `${WORKER_URLS.CUSTOMER_API}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Game API (port 8791)
      {
        command: process.platform === 'win32'
          ? `cd serverless/game-api && set CI=true && set NO_INPUT=1 && wrangler dev --port ${BASE_PORT + 4} --local`
          : `cd serverless/game-api && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 4} --local`,
        url: `${WORKER_URLS.GAME_API}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Chat Signaling (port 8792)
      {
        command: process.platform === 'win32'
          ? `cd serverless/chat-signaling && set CI=true && set NO_INPUT=1 && wrangler dev --port ${BASE_PORT + 5} --local`
          : `cd serverless/chat-signaling && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 5} --local`,
        url: `${WORKER_URLS.CHAT_SIGNALING}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // URL Shortener (port 8793)
      {
        command: process.platform === 'win32'
          ? `cd serverless/url-shortener && set CI=true && set NO_INPUT=1 && wrangler dev --port ${BASE_PORT + 6} --local`
          : `cd serverless/url-shortener && CI=true NO_INPUT=1 wrangler dev --port ${BASE_PORT + 6} --local`,
        url: `${WORKER_URLS.URL_SHORTENER}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
    ] : []),
  ],
});

// Export worker URLs for use in tests
export { WORKER_URLS };

