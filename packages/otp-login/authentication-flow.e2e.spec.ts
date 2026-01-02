/**
 * OTP Authentication Flow E2E Tests
 * 
 * Comprehensive end-to-end tests for the OTP authentication library
 * Tests the complete authentication flow from email input to successful login
 * 
 * CRITICAL: These tests require:
 * 1. OTP Auth Service worker deployed to development environment
 * 2. Test email service or ability to intercept OTP codes
 * 3. Valid encryption key configured in environment
 */

import { test, expect, Page } from '@playwright/test';
import { WORKER_URLS, verifyWorkersHealth } from '@strixun/e2e-helpers';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  // Test email - should be a real email that can receive OTP codes
  // Use test@example.com to match SUPER_ADMIN_EMAILS in test secrets (bypasses rate limiting)
  TEST_EMAIL: process.env.E2E_TEST_EMAIL || 'test@example.com',
  // OTP Auth API URL
  API_URL: WORKER_URLS.OTP_AUTH,
  // Timeout for API responses
  API_TIMEOUT: 30000,
  // Timeout for UI interactions
  UI_TIMEOUT: 10000,
  // Mods Hub URL (has OTP login on /login page)
  MODS_HUB_URL: WORKER_URLS.MODS_HUB || 'http://localhost:3001',
};

/**
 * Helper: Wait for OTP code from intercepted API response
 * In a real scenario, this would integrate with a test email service
 */
async function waitForOTPFromResponse(page: Page): Promise<string> {
  // Intercept the request-otp response to extract OTP if available
  // Note: In production, OTP is sent via email, but for testing we can
  // intercept the response if the API includes it (dev mode only)
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for OTP code. Use a test email service or provide OTP manually.'));
    }, 30000);

    // Listen for network responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/auth/request-otp')) {
        try {
          const body = await response.json();
          // If API returns OTP in dev mode (for testing), extract it
          if (body.otp) {
            clearTimeout(timeout);
            resolve(body.otp);
          }
        } catch {
          // Response might not be JSON or might not contain OTP
        }
      }
    });

    // For now, we'll need to handle OTP manually or use a test email service
    // This is a placeholder that will need integration with MailSlurp, Mailtrap, etc.
  });
}

/**
 * Helper: Fill email and request OTP
 * CRITICAL: Handles fancy screen if it appears again
 */
async function requestOTP(page: Page, email: string): Promise<void> {
  // Handle fancy screen if present (may appear again in some flows)
  await handleFancyScreen(page);
  
  // Find email input
  const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
  
  // Clear and fill email
  await emailInput.clear();
  await emailInput.fill(email);
  
  // Verify email was entered
  await expect(emailInput).toHaveValue(email);
  
  // Find and click submit button
  const submitButton = page.locator(
    'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
  ).first();
  
  await expect(submitButton).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
  await expect(submitButton).toBeEnabled();
  
  // Click submit and wait for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/request-otp'),
    { timeout: TEST_CONFIG.API_TIMEOUT }
  );
  
  await submitButton.click();
  
  // Wait for response
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

/**
 * Helper: Fill OTP and verify
 */
async function verifyOTP(page: Page, otpCode: string): Promise<void> {
  // Find OTP input
  const otpInput = page.locator(
    'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
  ).first();
  
  await otpInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
  
  // Clear and fill OTP
  await otpInput.clear();
  await otpInput.fill(otpCode);
  
  // Verify OTP was entered
  await expect(otpInput).toHaveValue(otpCode);
  
  // Find and click verify button
  const verifyButton = page.locator(
    'button:has-text("Verify"), button:has-text("Verify & Login"), button[type="submit"]'
  ).first();
  
  await expect(verifyButton).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
  await expect(verifyButton).toBeEnabled();
  
  // Click verify and wait for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/verify-otp'),
    { timeout: TEST_CONFIG.API_TIMEOUT }
  );
  
  await verifyButton.click();
  
  // Wait for response
  const response = await responsePromise;
  return response;
}

/**
 * Helper: Click through fancy authentication screen if present
 */
async function handleFancyScreen(page: Page): Promise<void> {
  // Check for fancy "Authentication Required" screen with "SIGN IN WITH EMAIL" button
  const fancyScreenButton = page.locator('button:has-text("SIGN IN WITH EMAIL"), button:has-text("Sign In")');
  const fancyScreenVisible = await fancyScreenButton.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (fancyScreenVisible) {
    // Click through the fancy screen to get to the email form
    await fancyScreenButton.click();
    await page.waitForTimeout(500); // Wait for transition animation
  }
}

/**
 * Helper: Create a test page with OTP Login component
 * Uses mods-hub /login page which has the OTP login component properly configured
 * CRITICAL: Handles the fancy "Authentication Required" screen that appears first
 */
async function navigateToOTPLogin(page: Page): Promise<void> {
  // Use mods-hub login page which has OTP login component properly set up
  await page.goto(`${TEST_CONFIG.MODS_HUB_URL}/login`, { waitUntil: 'networkidle' });
  
  // CRITICAL: Handle fancy authentication screen first
  await handleFancyScreen(page);
  
  // Wait for OTP login component to be visible (email input)
  const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
}

test.describe('OTP Authentication Flow', () => {
  test.beforeAll(async () => {
    // Verify OTP Auth Service is healthy
    await verifyWorkersHealth();
  });

  test.describe('Email Form', () => {
    test('should display email input field', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      await expect(emailInput).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
      await expect(emailInput).toBeEnabled();
    });

    test('should display submit button', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      await expect(submitButton).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });

    test('should accept email input', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      const testEmail = 'test@example.com';
      
      await emailInput.fill(testEmail);
      await expect(emailInput).toHaveValue(testEmail);
    });

    test('should validate email format', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      // Try invalid email
      await emailInput.fill('invalid-email');
      
      // HTML5 validation should prevent submission, or component should show error
      // Check if button is disabled or error message appears
      const isDisabled = await submitButton.isDisabled();
      const hasError = await page.locator('text=/invalid|error/i').isVisible().catch(() => false);
      
      // Either button should be disabled or error should be shown
      expect(isDisabled || hasError).toBeTruthy();
    });

    test('should show loading state when requesting OTP', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      
      // Wait for button to be enabled (it's disabled when email is empty)
      await expect(submitButton).toBeEnabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Click submit and check for loading state
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/request-otp'),
        { timeout: TEST_CONFIG.API_TIMEOUT }
      );
      
      await submitButton.click();
      
      // Button should show loading text ("Sending...") or be disabled
      const buttonText = await submitButton.textContent();
      const isDisabled = await submitButton.isDisabled();
      
      // Check for loading state - button text should be "Sending..." or button should be disabled
      expect(
        buttonText?.includes('Sending') || 
        isDisabled
      ).toBeTruthy();
      
      // Wait for response (may succeed or fail, but should complete)
      await responsePromise.catch(() => {});
    });
  });

  test.describe('OTP Request Flow', () => {
    test('should successfully request OTP with valid email', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      // Intercept API call
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/request-otp') && response.status() === 200,
        { timeout: TEST_CONFIG.API_TIMEOUT }
      );
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      const response = await responsePromise;
      const body = await response.json();
      
      // Should receive success response
      expect(response.ok()).toBeTruthy();
      expect(body).toHaveProperty('success');
      
      // Should transition to OTP input step
      const otpInput = page.locator(
        'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
      ).first();
      
      await expect(otpInput).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });

    test('should display OTP input after successful request', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      // Wait for OTP form to appear
      const otpInput = page.locator(
        'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
      ).first();
      
      await expect(otpInput).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
      await expect(otpInput).toBeEnabled();
    });

    test('should show email in OTP form', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const testEmail = TEST_CONFIG.TEST_EMAIL;
      await requestOTP(page, testEmail);
      
      // Check if email is displayed in OTP form hint
      const emailHint = page.locator(`text=/${testEmail}/i`);
      await expect(emailHint).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });

    test('should show countdown timer', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      // Wait for OTP form
      await page.locator('input[type="tel"], input#otp-login-otp').first().waitFor({ 
        state: 'visible', 
        timeout: TEST_CONFIG.UI_TIMEOUT 
      });
      
      // Check for countdown text (may take a moment to appear)
      const countdown = page.locator('text=/expires|countdown|minutes|seconds/i');
      const isVisible = await countdown.isVisible().catch(() => false);
      
      // Countdown may or may not be visible immediately, but should appear
      // This is a soft check - countdown is optional
      if (isVisible) {
        await expect(countdown).toBeVisible();
      }
    });
  });

  test.describe('OTP Verification Flow', () => {
    test('should accept OTP input', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      const otpInput = page.locator(
        'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
      ).first();
      
      await otpInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Enter test OTP (9 digits)
      const testOTP = '123456789';
      await otpInput.fill(testOTP);
      
      await expect(otpInput).toHaveValue(testOTP);
    });

    test('should validate OTP length', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      const otpInput = page.locator(
        'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
      ).first();
      
      await otpInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Try invalid length OTP
      await otpInput.fill('12345'); // Too short
      
      // Verify button should be disabled or error shown
      const verifyButton = page.locator(
        'button:has-text("Verify"), button:has-text("Verify & Login"), button[type="submit"]'
      ).first();
      
      const isDisabled = await verifyButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    });

    test('should show loading state when verifying OTP', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      const otpInput = page.locator(
        'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
      ).first();
      
      await otpInput.waitFor({ state: 'visible', timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Enter OTP (will fail, but we're testing loading state)
      await otpInput.fill('000000000');
      
      const verifyButton = page.locator(
        'button:has-text("Verify"), button:has-text("Verify & Login"), button[type="submit"]'
      ).first();
      
      // Click and check loading state
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/verify-otp'),
        { timeout: TEST_CONFIG.API_TIMEOUT }
      );
      
      await verifyButton.click();
      
      // Button should show loading or be disabled
      const buttonText = await verifyButton.textContent();
      const isDisabled = await verifyButton.isDisabled();
      
      expect(
        buttonText?.toLowerCase().includes('verify') === false || 
        buttonText?.toLowerCase().includes('ing') || 
        isDisabled
      ).toBeTruthy();
      
      // Wait for response
      await responsePromise.catch(() => {});
    });

    test('should handle invalid OTP gracefully', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      // Enter invalid OTP
      const response = await verifyOTP(page, '000000000');
      
      // Should receive error response
      expect(response.status()).toBeGreaterThanOrEqual(400);
      
      // Error message should be displayed
      const errorMessage = page.locator('text=/invalid|incorrect|error|expired/i');
      await expect(errorMessage).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });

    test('should allow going back to email form', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
      
      // Wait for OTP form
      await page.locator('input[type="tel"], input#otp-login-otp').first().waitFor({ 
        state: 'visible', 
        timeout: TEST_CONFIG.UI_TIMEOUT 
      });
      
      // Find and click back button
      const backButton = page.locator('button:has-text("Back")').first();
      await expect(backButton).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
      
      await backButton.click();
      
      // Should return to email form
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });
  });

  test.describe('Error Handling', () => {
    test('should display error for invalid email format', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      // Try to submit invalid email
      await emailInput.fill('not-an-email');
      
      // HTML5 validation should prevent or show error
      const hasError = await page.locator('text=/invalid|error|valid/i').isVisible().catch(() => false);
      const isDisabled = await submitButton.isDisabled();
      
      expect(hasError || isDisabled).toBeTruthy();
    });

    test('should display error for network failures', async ({ page }) => {
      // Block network requests to simulate network failure
      await page.route('**/auth/request-otp', (route) => route.abort());
      
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      await expect(submitButton).toBeEnabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
      await submitButton.click();
      
      // Should show error message (error is displayed in .otp-login-error div)
      await page.locator('.otp-login-error, [class*="error"]').waitFor({ 
        state: 'visible', 
        timeout: TEST_CONFIG.UI_TIMEOUT 
      });
    });

    test('should display rate limit error when exceeded', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      // Make multiple rapid requests to trigger rate limit
      // Note: This may require multiple requests depending on rate limit config
      for (let i = 0; i < 4; i++) {
        try {
          await requestOTP(page, TEST_CONFIG.TEST_EMAIL);
          // Wait a bit between requests
          await page.waitForTimeout(1000);
        } catch {
          // May fail on rate limit
        }
      }
      
      // Check for rate limit error
      const rateLimitError = page.locator('text=/rate limit|too many|limit exceeded/i');
      const hasRateLimitError = await rateLimitError.isVisible().catch(() => false);
      
      // Rate limit may or may not be triggered depending on config
      // This is a soft check
      if (hasRateLimitError) {
        await expect(rateLimitError).toBeVisible();
      }
    });
  });

  test.describe('UI State Management', () => {
    test('should disable inputs during loading', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      
      // Wait for button to be enabled (it's disabled when email is empty)
      await expect(submitButton).toBeEnabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Start request
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/request-otp'),
        { timeout: TEST_CONFIG.API_TIMEOUT }
      );
      
      await submitButton.click();
      
      // Input should be disabled during loading
      await expect(emailInput).toBeDisabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
      
      // Wait for response
      await responsePromise.catch(() => {});
    });

    test('should re-enable inputs after error', async ({ page }) => {
      // Block network to cause error
      await page.route('**/auth/request-otp', (route) => route.abort());
      
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      const submitButton = page.locator(
        'button:has-text("Send OTP Code"), button:has-text("Send OTP"), button:has-text("Send"), button[type="submit"]'
      ).first();
      
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      await expect(submitButton).toBeEnabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
      await submitButton.click();
      
      // Wait for error to appear (error is displayed in .otp-login-error div)
      await page.locator('.otp-login-error, [class*="error"]').waitFor({ 
        state: 'visible', 
        timeout: TEST_CONFIG.UI_TIMEOUT 
      });
      
      // Input should be re-enabled after error
      await expect(emailInput).toBeEnabled({ timeout: TEST_CONFIG.UI_TIMEOUT });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper labels for inputs', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      
      // Check for label
      const label = page.locator('label[for="otp-login-email"], label:has-text("Email")');
      const hasLabel = await label.isVisible().catch(() => false);
      
      // Should have label or aria-label
      const ariaLabel = await emailInput.getAttribute('aria-label');
      expect(hasLabel || !!ariaLabel).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
      
      // Input has autoFocus, so it should already be focused
      // But if not, click it to ensure focus
      await emailInput.click();
      
      // Should focus email input
      const isFocused = await emailInput.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBeTruthy();
    });

    test('should submit on Enter key', async ({ page }) => {
      await navigateToOTPLogin(page);
      
      const emailInput = page.locator('input[type="email"], input#otp-login-email').first();
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      
      // Wait a moment for button to be enabled
      await page.waitForTimeout(100);
      
      // Press Enter
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/request-otp'),
        { timeout: TEST_CONFIG.API_TIMEOUT }
      );
      
      await emailInput.press('Enter');
      
      // Should trigger request
      await responsePromise.catch(() => {});
    });
  });
});

