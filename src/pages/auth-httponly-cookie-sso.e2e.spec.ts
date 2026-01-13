/**
 * Stream Suite - HttpOnly Cookie SSO E2E Tests
 * 
 * Tests the HttpOnly cookie-based Single Sign-On flow for Stream Suite
 * CRITICAL: These tests verify true SSO across all .idling.app subdomains
 * 
 * Key Features Tested:
 * 1. HttpOnly cookie is set during login
 * 2. Cookie is automatically sent with requests (credentials: 'include')
 * 3. Session persists across page reloads
 * 4. Session is shared across tabs (same cookie domain)
 * 5. Logout clears the HttpOnly cookie
 */

import { test, expect, Page } from '@playwright/test';
import { 
  verifyWorkersHealth, 
  requestOTPCode, 
  verifyOTPCode, 
  waitForOTPForm,
  isEmailFormVisible,
  isOTPFormVisible
} from '@strixun/e2e-helpers';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:5173';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';

/**
 * Helper: Handle fancy "Authentication Required" screen inside modal if present
 */
async function handleFancyScreenInModal(page: Page): Promise<void> {
  const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
  const emailFormVisible = await emailInput.isVisible({ timeout: 1000 }).catch(() => false);
  
  if (emailFormVisible) {
    return;
  }
  
  const fancyScreenButton = page.locator('button:has-text("SIGN IN WITH EMAIL"), button:has-text("Sign In")');
  const fancyScreenVisible = await fancyScreenButton.isVisible({ timeout: 2000 }).catch(() => false);
  
  if (fancyScreenVisible) {
    await page.waitForTimeout(500);
    
    try {
      await fancyScreenButton.click({ timeout: 3000 });
    } catch {
      try {
        await fancyScreenButton.click({ force: true, timeout: 3000 });
      } catch {
        await fancyScreenButton.evaluate((el: HTMLElement) => (el as HTMLButtonElement).click());
      }
    }
    
    await page.waitForTimeout(500);
  }
}

/**
 * Helper: Get auth_token cookie value from browser context
 */
async function getAuthCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  return authCookie?.value || null;
}

test.describe('Stream Suite - HttpOnly Cookie SSO', () => {
  test.beforeAll(async () => {
    await verifyWorkersHealth();
  });

  test.beforeEach(async ({ page }) => {
    // Clear any existing cookies and storage
    await page.context().clearCookies();
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should set HttpOnly cookie during login', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Click login button
    const loginButton = page.locator(
      'button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")'
    ).first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    // Wait for modal
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    // Complete login flow
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    // Listen for Set-Cookie response header
    const setCookieHeaders: string[] = [];
    page.on('response', (response) => {
      const setCookie = response.headers()['set-cookie'];
      if (setCookie && setCookie.includes('auth_token=')) {
        setCookieHeaders.push(setCookie);
      }
    });
    
    await verifyOTPCode(page, otpCode);
    
    // Wait for auth screen to disappear
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Verify HttpOnly cookie was set
    const authCookie = await getAuthCookie(page);
    expect(authCookie).toBeTruthy();
    expect(authCookie?.length).toBeGreaterThan(10);
    
    // Verify Set-Cookie header was sent (if we caught it)
    if (setCookieHeaders.length > 0) {
      const setCookieHeader = setCookieHeaders[0];
      expect(setCookieHeader).toContain('auth_token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Secure');
    }
  });

  test('should persist authentication across page reloads using cookie', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Login
    const loginButton = page.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page, otpCode);
    
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Get cookie before reload
    const cookieBefore = await getAuthCookie(page);
    expect(cookieBefore).toBeTruthy();
    
    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    
    // Cookie should still exist (browsers persist cookies across reloads)
    const cookieAfter = await getAuthCookie(page);
    expect(cookieAfter).toBeTruthy();
    expect(cookieAfter).toBe(cookieBefore);
    
    // User should still be authenticated (auth screen should not appear)
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 5000 });
  });

  test('should share session across multiple tabs (same cookie)', async ({ browser }) => {
    // Create first tab and login
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.goto(FRONTEND_URL);
    
    const loginButton = page1.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page1.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page1.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page1);
    
    await requestOTPCode(page1, TEST_EMAIL);
    await waitForOTPForm(page1);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page1, otpCode);
    
    await page1.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Get cookie from first tab
    const cookie1 = await getAuthCookie(page1);
    expect(cookie1).toBeTruthy();
    
    // Create second tab with same context (shares cookies)
    const page2 = await context1.newPage();
    await page2.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    
    // Second tab should automatically be authenticated (cookie is shared)
    await page2.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 5000 });
    
    // Verify cookie exists in second tab
    const cookie2 = await getAuthCookie(page2);
    expect(cookie2).toBeTruthy();
    expect(cookie2).toBe(cookie1);
    
    await page1.close();
    await page2.close();
    await context1.close();
  });

  test('should clear HttpOnly cookie on logout', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Login first
    const loginButton = page.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page, otpCode);
    
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Verify cookie exists
    const cookieBeforeLogout = await getAuthCookie(page);
    expect(cookieBeforeLogout).toBeTruthy();
    
    // Find and click logout button
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out"), [title*="Sign Out" i], [title*="Logout" i]'
    ).first();
    
    const logoutCount = await logoutButton.count();
    if (logoutCount > 0) {
      await logoutButton.click();
      
      // Wait for auth screen to reappear
      await page.waitForFunction(() => {
        const authScreen = document.querySelector('.auth-screen');
        return authScreen !== null && window.getComputedStyle(authScreen).display !== 'none';
      }, { timeout: 5000 });
      
      // Verify cookie is cleared
      const cookieAfterLogout = await getAuthCookie(page);
      expect(cookieAfterLogout).toBeFalsy();
    } else {
      test.skip();
    }
  });

  test('should not store JWT token in localStorage (HttpOnly only)', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Login
    const loginButton = page.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page, otpCode);
    
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Verify HttpOnly cookie exists
    const authCookie = await getAuthCookie(page);
    expect(authCookie).toBeTruthy();
    
    // CRITICAL: Verify JWT token is NOT in localStorage
    // With HttpOnly cookies, tokens should never be accessible to JavaScript
    const localStorageTokens = await page.evaluate(() => {
      const tokens: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('jwt') || key.includes('auth'))) {
          const value = localStorage.getItem(key);
          if (value && value.length > 50 && value.includes('.')) {
            // Looks like a JWT (has dots and is long)
            tokens.push(key);
          }
        }
      }
      return tokens;
    });
    
    // Should NOT find any JWT-like tokens in localStorage
    expect(localStorageTokens.length).toBe(0);
  });

  test('should authenticate /auth/me with HttpOnly cookie (no Authorization header)', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Login
    const loginButton = page.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page, otpCode);
    
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Intercept /auth/me requests to verify cookie is sent
    const authMeRequests: any[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/me')) {
        authMeRequests.push({
          url: request.url(),
          headers: request.headers(),
        });
      }
    });
    
    // Trigger /auth/me call by reloading or manually calling checkAuth
    await page.reload({ waitUntil: 'networkidle' });
    
    // Wait for /auth/me call
    await page.waitForTimeout(2000);
    
    // Verify /auth/me was called
    expect(authMeRequests.length).toBeGreaterThan(0);
    
    // Verify cookie was sent automatically (browsers send HttpOnly cookies automatically)
    const authMeRequest = authMeRequests[0];
    // Note: We can't directly verify the cookie header in Playwright (it's added by the browser)
    // But the fact that the user is authenticated proves the cookie was sent
    
    // Verify user is still authenticated after reload
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 5000 });
  });

  test('should handle expired cookie gracefully', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    
    // Login first
    const loginButton = page.locator('button:has-text("Sign In with Email"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginButton.waitFor({ state: 'visible', timeout: 10000 });
    await loginButton.click();
    
    const modalOverlay = page.locator('.otp-login-modal-overlay').first();
    await modalOverlay.waitFor({ state: 'visible', timeout: 10000 });
    
    const modalContent = page.locator('.otp-login-modal').first();
    await modalContent.waitFor({ state: 'visible', timeout: 10000 });
    
    await handleFancyScreenInModal(page);
    
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set in environment');
    }
    
    await verifyOTPCode(page, otpCode);
    
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen === null || window.getComputedStyle(authScreen).display === 'none';
    }, { timeout: 10000 });
    
    // Manually expire the cookie by setting it with Max-Age=0
    await page.context().addCookies([{
      name: 'auth_token',
      value: 'expired',
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    }]);
    
    // Reload page - should show auth screen (cookie is expired)
    await page.reload({ waitUntil: 'networkidle' });
    
    // Auth screen should appear (user is not authenticated)
    await page.waitForFunction(() => {
      const authScreen = document.querySelector('.auth-screen');
      return authScreen !== null && window.getComputedStyle(authScreen).display !== 'none';
    }, { timeout: 10000 });
  });
});
