/**
 * E2E Test Helpers
 * 
 * Shared utilities for end-to-end testing with Playwright
 * Used across all E2E tests in the codebase
 */

import { Page, expect } from '@playwright/test';
import { WORKER_URLS } from '../../playwright.config.js';

// Re-export WORKER_URLS for convenience
export { WORKER_URLS };

// Define BASE_PORT (must match playwright.config.ts)
// Used for error messages when workers are unhealthy
const BASE_PORT = parseInt(process.env.E2E_LOCAL_WORKER_PORT || '8787', 10);

// Re-export email interception helpers
export { getInterceptedOTP, waitForInterceptedOTP } from './email-interception.js';

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
export async function waitForOTP(_page: Page): Promise<string> {
  // TODO: Integrate with test email service (e.g., Mailtrap, MailSlurp)
  // For now, this is a placeholder that would need manual OTP entry
  // or integration with a test email service
  
  // Example: If using MailSlurp or similar
  // const email = await mailSlurp.waitForLatestEmail(TEST_USERS.regular.email);
  // return extractOTPFromEmail(email);
  
  throw new Error('OTP extraction not yet implemented. Integrate with test email service.');
}

/**
 * OTP-specific test helpers
 */

/**
 * Request OTP code for an email address
 * Returns the API response for inspection
 */
export async function requestOTPCode(
  page: Page,
  email: string
): Promise<{ response: any; body: any }> {
  // Find email input
  const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  
  // Fill email
  await emailInput.clear();
  await emailInput.fill(email);
  
  // Find and click submit button
  const submitButton = page.locator(
    'button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
  ).first();
  
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  
  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/request-otp'),
    { timeout: 30000 }
  );
  
  await submitButton.click();
  
  const response = await responsePromise;
  const body = await response.json();
  
  return { response, body };
}

/**
 * Verify OTP code
 * Returns the API response for inspection
 */
export async function verifyOTPCode(
  page: Page,
  otpCode: string
): Promise<{ response: any; body: any }> {
  // Find OTP input
  const otpInput = page.locator(
    'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
  ).first();
  
  await otpInput.waitFor({ state: 'visible', timeout: 10000 });
  
  // Fill OTP
  await otpInput.clear();
  await otpInput.fill(otpCode);
  
  // Find and click verify button
  const verifyButton = page.locator(
    'button:has-text("Verify"), button:has-text("Verify & Login"), button[type="submit"]'
  ).first();
  
  await expect(verifyButton).toBeVisible({ timeout: 10000 });
  
  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/verify-otp'),
    { timeout: 30000 }
  );
  
  await verifyButton.click();
  
  const response = await responsePromise;
  const body = await response.json();
  
  return { response, body };
}

/**
 * Wait for OTP form to appear after requesting OTP
 */
export async function waitForOTPForm(page: Page, timeout: number = 10000): Promise<void> {
  const otpInput = page.locator(
    'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
  ).first();
  
  await otpInput.waitFor({ state: 'visible', timeout });
}

/**
 * Check if email form is visible
 */
export async function isEmailFormVisible(page: Page): Promise<boolean> {
  const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
  return await emailInput.isVisible().catch(() => false);
}

/**
 * Check if OTP form is visible
 */
export async function isOTPFormVisible(page: Page): Promise<boolean> {
  const otpInput = page.locator(
    'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
  ).first();
  return await otpInput.isVisible().catch(() => false);
}

/**
 * Navigate back to email form from OTP form
 */
export async function goBackToEmailForm(page: Page): Promise<void> {
  const backButton = page.locator('button:has-text("Back")').first();
  await expect(backButton).toBeVisible({ timeout: 10000 });
  await backButton.click();
  
  // Wait for email form to appear
  await page.locator('input[type="email"], input#otp-login-email').first().waitFor({
    state: 'visible',
    timeout: 10000,
  });
}

/**
 * Extract OTP from intercepted API response (for dev/test environments)
 * Note: This only works if the API returns OTP in the response (dev mode)
 */
export async function extractOTPFromResponse(
  page: Page,
  timeout: number = 30000
): Promise<string | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeout);
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/auth/request-otp')) {
        try {
          const body = await response.json();
          if (body.otp && typeof body.otp === 'string') {
            clearTimeout(timeoutId);
            resolve(body.otp);
          }
        } catch {
          // Response might not be JSON or might not contain OTP
        }
      }
    });
  });
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
    (response) => {
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
export async function checkWorkerHealth(workerUrl: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${workerUrl}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Verify local workers are accessible
 * 
 * E2E tests ONLY use local workers (localhost) - no deployed workers.
 * This ensures complete isolation from production and development deployments.
 */
export async function verifyWorkersHealth(): Promise<void> {
  // Safety check: Ensure all URLs are localhost (no deployed workers)
  const allUrls = Object.values(WORKER_URLS);
  const nonLocalUrls = allUrls.filter(url => 
    typeof url === 'string' && 
    !url.includes('localhost') && 
    !url.includes('127.0.0.1')
  );
  
  if (nonLocalUrls.length > 0) {
    throw new Error(
      `[E2E SAFETY] Non-local URLs detected in test configuration:\n` +
      `${nonLocalUrls.join('\n')}\n\n` +
      `E2E tests MUST only use local workers (localhost).\n` +
      `This ensures complete isolation from production and development deployments.`
    );
  }
  
  // Check all workers that are started locally (replicating production deployment)
  // All services are started automatically in playwright.config.ts
  // ALL workers must be healthy for E2E tests to run properly
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
      healthy: await checkWorkerHealth(worker.url, 10000),
    }))
  );
  
  const unhealthy = results.filter((r) => !r.healthy);
  if (unhealthy.length > 0) {
    throw new Error(
      `Unhealthy local workers: ${unhealthy.map((w) => w.name).join(', ')}\n` +
      `All workers must be healthy for E2E tests to run properly.\n` +
      `Make sure local workers are running. They should start automatically.\n` +
      `If not, start manually:\n` +
      `  cd serverless/otp-auth-service && pnpm dev (port ${BASE_PORT})\n` +
      `  cd serverless/mods-api && pnpm dev (port ${BASE_PORT + 1})\n` +
      `  cd serverless/twitch-api && pnpm dev (port ${BASE_PORT + 2})\n` +
      `  cd serverless/customer-api && pnpm dev (port ${BASE_PORT + 3})\n` +
      `  cd serverless/game-api && pnpm dev (port ${BASE_PORT + 4})\n` +
      `  cd serverless/chat-signaling && pnpm dev (port ${BASE_PORT + 5})\n` +
      `  cd serverless/url-shortener && pnpm dev (port ${BASE_PORT + 6})`
    );
  }
}

/**
 * Clean up test data (if needed)
 */
export async function cleanupTestData(_page: Page): Promise<void> {
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

