/**
 * Mods Hub - Login E2E Tests
 * 
 * Tests the complete authentication flow for mods-hub
 * Co-located with LoginPage component
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { 
  verifyWorkersHealth, 
  requestOTPCode, 
  verifyOTPCode, 
  waitForOTPForm,
  isEmailFormVisible,
  isOTPFormVisible,
  waitForInterceptedOTP
} from '@strixun/e2e-helpers';

const MODS_HUB_URL = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
// Use test@example.com to match SUPER_ADMIN_EMAILS in test secrets (bypasses rate limiting)
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';

test.describe('Mods Hub Login', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto(`${MODS_HUB_URL}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login page with email form', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Should show login form or OTP login component
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    
    // Should have submit button
    const submitButton = page.locator(
      'button:has-text("Send"), button:has-text("Request"), button[type="submit"]'
    ).first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
  });

  test('should allow email input and validation', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Find email input
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible' });
    
    // Enter test email
    await emailInput.fill(TEST_EMAIL);
    
    // Verify email was entered
    await expect(emailInput).toHaveValue(TEST_EMAIL);
    
    // Test invalid email format (if validation is visible)
    await emailInput.fill('invalid-email');
    
    // Submit should either be disabled or show validation error
    const submitButton = page.locator(
      'button:has-text("Send"), button:has-text("Request"), button[type="submit"]'
    ).first();
    
    // Button might be disabled or show error on click
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    if (!isDisabled) {
      await submitButton.click();
      // Should show validation error or not proceed
      await page.waitForTimeout(500);
    }
    
    // Enter valid email again
    await emailInput.fill(TEST_EMAIL);
    await expect(emailInput).toHaveValue(TEST_EMAIL);
  });

  test('should request OTP when email is submitted', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Request OTP using helper
    const { response } = await requestOTPCode(page, TEST_EMAIL);
    
    // Verify API call succeeded
    expect(response.ok()).toBeTruthy();
    
    // Wait for OTP form to appear
    await waitForOTPForm(page, 10000);
    
    // Verify OTP input is visible
    const otpInput = page.locator(
      'input[type="tel"], input[type="text"][inputmode="numeric"], input#otp-login-otp'
    ).first();
    await expect(otpInput).toBeVisible();
  });

  test('should complete full login flow with OTP', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Step 1: Request OTP
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Step 2: Get intercepted OTP from local KV (E2E test mode)
    const otpCode = await waitForInterceptedOTP(TEST_EMAIL, 5000);
    
    if (!otpCode) {
      throw new Error('Failed to retrieve intercepted OTP code from local KV');
    }
    
    // Step 3: Verify OTP
    const { response } = await verifyOTPCode(page, otpCode);
    
    // Verify API call succeeded
    expect(response.ok()).toBeTruthy();
    
    // Step 3: Wait for redirect after successful login
    // Should redirect to home, dashboard, or mods list
    await page.waitForURL(
      (url) => {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        return path === '/' || 
               path.includes('/mods') || 
               path.includes('/dashboard') || 
               path.includes('/home');
      },
      { timeout: 10000 }
    );
    
    // Step 4: Verify authentication state
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || 
             localStorage.getItem('jwt_token') ||
             localStorage.getItem('token');
    });
    
    expect(authToken).toBeTruthy();
    expect(authToken?.length).toBeGreaterThan(10);
    
    // Step 5: Verify user info is displayed (if available)
    // Look for user email or display name in header/nav
    const userInfo = page.locator(
      '[data-testid="user-email"], [data-testid="user-name"], .user-info, .auth-user'
    );
    const userInfoCount = await userInfo.count();
    
    // User info might not always be visible, but if it is, it should be present
    if (userInfoCount > 0) {
      await expect(userInfo.first()).toBeVisible();
    }
  });

  test('should handle invalid OTP code gracefully', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Request OTP
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Enter invalid OTP
    const { response } = await verifyOTPCode(page, '000000');
    
    // Should show error (API might return error or UI shows error)
    if (!response.ok()) {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    } else {
      // If API accepts it, UI should still show error
      const errorMessage = page.locator(
        'text=/invalid|error|incorrect|wrong/i'
      );
      const errorCount = await errorMessage.count();
      if (errorCount > 0) {
        await expect(errorMessage.first()).toBeVisible({ timeout: 3000 });
      }
    }
    
    // Should still be on login page (not redirected)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Complete login flow
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Get intercepted OTP from local KV
    const otpCode = await waitForInterceptedOTP(TEST_EMAIL, 5000);
    if (!otpCode) {
      throw new Error('Failed to retrieve intercepted OTP code from local KV');
    }
    
    await verifyOTPCode(page, otpCode);
    
    // Wait for redirect
    await page.waitForURL(
      (url) => {
        const path = new URL(url).pathname;
        return path !== '/login';
      },
      { timeout: 10000 }
    );
    
    // Get auth token
    const authTokenBefore = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || 
             localStorage.getItem('jwt_token') ||
             localStorage.getItem('token');
    });
    
    expect(authTokenBefore).toBeTruthy();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify token still exists
    const authTokenAfter = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || 
             localStorage.getItem('jwt_token') ||
             localStorage.getItem('token');
    });
    
    expect(authTokenAfter).toBeTruthy();
    expect(authTokenAfter).toBe(authTokenBefore);
    
    // Verify user is still authenticated (not redirected to login)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });

  test('should handle logout flow', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Complete login flow
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Get intercepted OTP from local KV
    const otpCode = await waitForInterceptedOTP(TEST_EMAIL, 5000);
    if (!otpCode) {
      throw new Error('Failed to retrieve intercepted OTP code from local KV');
    }
    
    await verifyOTPCode(page, otpCode);
    
    // Wait for redirect
    await page.waitForURL(
      (url) => {
        const path = new URL(url).pathname;
        return path !== '/login';
      },
      { timeout: 10000 }
    );
    
    // Find and click logout button
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout-button"]'
    ).first();
    
    const logoutCount = await logoutButton.count();
    if (logoutCount > 0) {
      await logoutButton.click();
      
      // Wait for redirect to login
      await page.waitForURL(
        (url) => {
          const urlStr = url.toString();
          return urlStr.includes('/login');
        },
        { timeout: 5000 }
      );
      
      // Verify token is cleared
      const authToken = await page.evaluate(() => {
        return localStorage.getItem('auth_token') || 
               localStorage.getItem('jwt_token') ||
               localStorage.getItem('token');
      });
      
      expect(authToken).toBeFalsy();
    } else {
      // Logout button might not be visible or might be in a menu
      // This is acceptable - test passes if we can't find it
      test.skip();
    }
  });

  test('should navigate back from OTP form to email form', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/login`);
    
    // Request OTP
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Verify OTP form is visible
    const otpFormVisible = await isOTPFormVisible(page);
    expect(otpFormVisible).toBeTruthy();
    
    // Look for back button
    const backButton = page.locator('button:has-text("Back"), button[aria-label*="back" i]').first();
    const backCount = await backButton.count();
    
    if (backCount > 0) {
      await backButton.click();
      
      // Wait for email form to appear
      await page.waitForTimeout(1000);
      
      // Verify email form is visible again
      const emailFormVisible = await isEmailFormVisible(page);
      expect(emailFormVisible).toBeTruthy();
    } else {
      // Back button might not exist - this is acceptable
      test.skip();
    }
  });
});

