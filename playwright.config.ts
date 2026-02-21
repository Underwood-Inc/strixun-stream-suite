import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load .dev.vars files into process.env for E2E tests
 */
function loadDevVars(): void {
  const devVarsPaths = [
    join(__dirname, 'serverless', 'mods-api', '.dev.vars'),
    join(__dirname, 'serverless', 'otp-auth-service', '.dev.vars'),
  ];
  
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
        }
      }
    }
  }
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
  SUITE_API: process.env.E2E_SUITE_API_URL || `http://localhost:${BASE_PORT + 2}`,
  CUSTOMER_API: process.env.E2E_CUSTOMER_API_URL || `http://localhost:${BASE_PORT + 3}`,
  GAME_API: process.env.E2E_GAME_API_URL || `http://localhost:${BASE_PORT + 4}`,
  CHAT_SIGNALING: process.env.E2E_CHAT_SIGNALING_URL || `http://localhost:${BASE_PORT + 5}`,
  URL_SHORTENER: process.env.E2E_URL_SHORTENER_URL || `http://localhost:${BASE_PORT + 6}`,
  FRONTEND: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
  MODS_HUB: process.env.E2E_MODS_HUB_URL || 'http://localhost:3001',
};

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
    // Note: E2E test credentials are loaded by loadDevVars() above and available via process.env
    // They are automatically available to test files through process.env
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
        // Override API URL for E2E tests
        // This ensures the main app uses local worker URLs
        VITE_AUTH_API_URL: WORKER_URLS.OTP_AUTH,
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
      },
    },
    // Start all local workers (E2E tests replicate production with all services running)
    // Each service runs on its own port to replicate production deployment
    ...(process.env.E2E_START_LOCAL_WORKER !== 'false' ? [
      // OTP Auth Service (port 8787)
      // Uses wrapper script to start server and check health with JWT
      {
        command: process.platform === 'win32'
          ? `cd serverless/otp-auth-service && set CI=true && set NO_INPUT=1 && pnpm setup:test-secrets && node ../../scripts/start-worker-with-health-check.js serverless/otp-auth-service ${BASE_PORT}`
          : `cd serverless/otp-auth-service && CI=true NO_INPUT=1 pnpm setup:test-secrets && node ../../scripts/start-worker-with-health-check.js serverless/otp-auth-service ${BASE_PORT}`,
        port: BASE_PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Mods API (port 8788)
      {
        command: process.platform === 'win32'
          ? `cd serverless/mods-api && set CI=true && set NO_INPUT=1 && pnpm setup:test-secrets && node ../../scripts/start-worker-with-health-check.js serverless/mods-api ${BASE_PORT + 1}`
          : `cd serverless/mods-api && CI=true NO_INPUT=1 pnpm setup:test-secrets && node ../../scripts/start-worker-with-health-check.js serverless/mods-api ${BASE_PORT + 1}`,
        port: BASE_PORT + 1,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Suite API (port 8789)
      {
        command: process.platform === 'win32'
          ? `cd serverless/suite-api && set CI=true && set NO_INPUT=1 && node ../../scripts/start-worker-with-health-check.js serverless/suite-api ${BASE_PORT + 2}`
          : `cd serverless/suite-api && CI=true NO_INPUT=1 node ../../scripts/start-worker-with-health-check.js serverless/suite-api ${BASE_PORT + 2}`,
        port: BASE_PORT + 2,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Customer API (port 8790)
      // Uses wrapper script to start server and check health with JWT
      {
        command: process.platform === 'win32'
          ? `cd serverless/customer-api && set CI=true && set NO_INPUT=1 && node ../../scripts/start-worker-with-health-check.js serverless/customer-api ${BASE_PORT + 3}`
          : `cd serverless/customer-api && CI=true NO_INPUT=1 node ../../scripts/start-worker-with-health-check.js serverless/customer-api ${BASE_PORT + 3}`,
        port: BASE_PORT + 3,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Game API (port 8791)
      {
        command: process.platform === 'win32'
          ? `cd serverless/game-api && set CI=true && set NO_INPUT=1 && node ../../scripts/start-worker-with-health-check.js serverless/game-api ${BASE_PORT + 4}`
          : `cd serverless/game-api && CI=true NO_INPUT=1 node ../../scripts/start-worker-with-health-check.js serverless/game-api ${BASE_PORT + 4}`,
        port: BASE_PORT + 4,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // Chat Signaling (port 8792)
      {
        command: process.platform === 'win32'
          ? `cd serverless/chat-signaling && set CI=true && set NO_INPUT=1 && node ../../scripts/start-worker-with-health-check.js serverless/chat-signaling ${BASE_PORT + 5}`
          : `cd serverless/chat-signaling && CI=true NO_INPUT=1 node ../../scripts/start-worker-with-health-check.js serverless/chat-signaling ${BASE_PORT + 5}`,
        port: BASE_PORT + 5,
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
      // URL Shortener (port 8793)
      // Build assets before starting worker (required for app-assets, decrypt-script, otp-core-script)
      {
        command: process.platform === 'win32'
          ? `cd serverless/url-shortener && set CI=true && set NO_INPUT=1 && pnpm build:all && node ../../scripts/start-worker-with-health-check.js serverless/url-shortener ${BASE_PORT + 6}`
          : `cd serverless/url-shortener && CI=true NO_INPUT=1 pnpm build:all && node ../../scripts/start-worker-with-health-check.js serverless/url-shortener ${BASE_PORT + 6}`,
        port: BASE_PORT + 6,
        reuseExistingServer: !process.env.CI,
        timeout: 300 * 1000, // Increased timeout to allow for build time
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
    ] : []),
  ],
});

// Export worker URLs for use in tests
export { WORKER_URLS };

