/**
 * E2E Test Helpers
 * 
 * Shared utilities for end-to-end testing with Playwright
 * Used across all E2E tests in the codebase
 */

import { Page, type APIResponse } from '@playwright/test';
import { WORKER_URLS } from '../../playwright.config.js';

// Re-export WORKER_URLS for convenience
export { WORKER_URLS };

/**
 * Test user credentials for E2E testing
 * These should be test accounts that won't affect production data
 */
export const TEST_USERS = {
  admin: {
    email: process.env.E2E_TEST_ADMIN_EMAIL || 'test-admin@example.com',
    // Note: OTP will be sent to this email during tests
  },
  regular: {
    email: process.env.E2E_TEST_USER_EMAIL || 'test-user@example.com',
  },
};

/**
 * Wait for OTP email and extract code
 * In a real scenario, you might use a test email service or mock
 */
export async function waitForOTP(page: Page): Promise<string> {
  // TODO: Integrate with test email service (e.g., Mailtrap, MailSlurp)
  // For now, this is a placeholder that would need manual OTP entry
  // or integration with a test email service
  
  // Example: If using MailSlurp or similar
  // const email = await mailSlurp.waitForLatestEmail(TEST_USERS.regular.email);
  // return extractOTPFromEmail(email);
  
  throw new Error('OTP extraction not yet implemented. Integrate with test email service.');
}

/**
 * Authenticate a user via OTP flow
 */
export async function authenticateUser(
  page: Page,
  email: string,
  otpCode?: string
): Promise<void> {
  // Navigate to auth page or trigger auth flow
  await page.goto('/');
  
  // Wait for auth UI or trigger login
  const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
  if (await loginButton.isVisible()) {
    await loginButton.click();
  }
  
  // Enter email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill(email);
  
  // Submit OTP request
  const requestOTPButton = page.locator('button:has-text("Send"), button:has-text("Request OTP")');
  await requestOTPButton.click();
  
  // Wait for OTP input
  const otpInput = page.locator('input[type="text"][inputmode="numeric"], input[name*="otp"]');
  await otpInput.waitFor({ state: 'visible' });
  
  // Enter OTP (if provided, otherwise wait for email)
  if (otpCode) {
    await otpInput.fill(otpCode);
  } else {
    const code = await waitForOTP(page);
    await otpInput.fill(code);
  }
  
  // Submit OTP
  const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Submit")');
  await verifyButton.click();
  
  // Wait for authentication to complete
  await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 });
}

/**
 * Make authenticated API request
 */
export async function authenticatedRequest(
  page: Page,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get auth token from localStorage or cookies
  const token = await page.evaluate(() => {
    return localStorage.getItem('auth_token') || 
           localStorage.getItem('jwt_token') ||
           document.cookie.match(/auth_token=([^;]+)/)?.[1];
  });
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Wait for API response with retry logic
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<void> {
  await page.waitForResponse(
    (response: APIResponse) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Check worker health
 */
export async function checkWorkerHealth(workerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${workerUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Verify all development workers are accessible
 */
export async function verifyWorkersHealth(): Promise<void> {
  const workers = [
    { name: 'OTP Auth', url: WORKER_URLS.OTP_AUTH },
    { name: 'Mods API', url: WORKER_URLS.MODS_API },
    { name: 'Twitch API', url: WORKER_URLS.TWITCH_API },
    { name: 'Customer API', url: WORKER_URLS.CUSTOMER_API },
    { name: 'Game API', url: WORKER_URLS.GAME_API },
    { name: 'Chat Signaling', url: WORKER_URLS.CHAT_SIGNALING },
    { name: 'URL Shortener', url: WORKER_URLS.URL_SHORTENER },
  ];
  
  const results = await Promise.all(
    workers.map(async (worker) => ({
      ...worker,
      healthy: await checkWorkerHealth(worker.url),
    }))
  );
  
  const unhealthy = results.filter((r) => !r.healthy);
  if (unhealthy.length > 0) {
    throw new Error(
      `Unhealthy workers: ${unhealthy.map((w) => w.name).join(', ')}\n` +
      `Make sure all workers are deployed to development environment.\n` +
      `Run: pnpm deploy:dev:all`
    );
  }
}

/**
 * Clean up test data (if needed)
 */
export async function cleanupTestData(page: Page): Promise<void> {
  // Implement cleanup logic for test data
  // This might involve calling admin APIs to delete test records
  // or clearing KV namespaces used for testing
}

/**
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

