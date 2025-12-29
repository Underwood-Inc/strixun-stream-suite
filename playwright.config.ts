import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * This configuration enables end-to-end testing against development Cloudflare Workers.
 * Tests run against live development deployments to ensure 100% accuracy.
 * 
 * Setup:
 * 1. Deploy all workers to development environment: pnpm deploy:dev:all
 * 2. Set environment variables for worker URLs (see .env.example)
 * 3. Run tests: pnpm test:e2e
 */

// Environment variables for worker URLs
// These should point to your development worker deployments
const WORKER_URLS = {
  OTP_AUTH: process.env.E2E_OTP_AUTH_URL || 'https://otp-auth-service-dev.strixuns-script-suite.workers.dev',
  MODS_API: process.env.E2E_MODS_API_URL || 'https://strixun-mods-api-dev.strixuns-script-suite.workers.dev',
  TWITCH_API: process.env.E2E_TWITCH_API_URL || 'https://strixun-twitch-api-dev.strixuns-script-suite.workers.dev',
  CUSTOMER_API: process.env.E2E_CUSTOMER_API_URL || 'https://strixun-customer-api-dev.strixuns-script-suite.workers.dev',
  GAME_API: process.env.E2E_GAME_API_URL || 'https://strixun-game-api-dev.strixuns-script-suite.workers.dev',
  CHAT_SIGNALING: process.env.E2E_CHAT_SIGNALING_URL || 'https://strixun-chat-signaling-dev.strixuns-script-suite.workers.dev',
  URL_SHORTENER: process.env.E2E_URL_SHORTENER_URL || 'https://strixun-url-shortener-dev.strixuns-script-suite.workers.dev',
  FRONTEND: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
  MODS_HUB: process.env.E2E_MODS_HUB_URL || 'http://localhost:3001',
};

export default defineConfig({
  // E2E tests are co-located with the code they test
  // Pattern: **/*.e2e.spec.ts or **/*.e2e.test.ts
  testMatch: /.*\.e2e\.(spec|test)\.(ts|js)/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['list'],
  ],
  use: {
    baseURL: WORKER_URLS.FRONTEND,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
      timeout: 120 * 1000,
    },
    {
      command: 'cd mods-hub && pnpm dev',
      url: WORKER_URLS.MODS_HUB,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});

// Export worker URLs for use in tests
export { WORKER_URLS };

