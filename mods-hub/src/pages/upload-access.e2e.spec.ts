/**
 * Mods Hub - Upload Access E2E Tests
 * 
 * Tests that authenticated users can access the upload page without token mismatch errors
 * This test reproduces and verifies the fix for the customer association/token mismatch issue
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { 
  verifyWorkersHealth, 
  requestOTPCode, 
  verifyOTPCode, 
  waitForOTPForm
} from '@strixun/e2e-helpers';

const MODS_HUB_URL = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';

test.describe('Upload Access After Login', () => {
  test.beforeAll(async () => {
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

  test('should access upload page after login without token mismatch errors', async ({ page }) => {
    // Step 1: Complete login flow
    await page.goto(`${MODS_HUB_URL}/login`, { waitUntil: 'networkidle' });
    
    // Handle fancy screen if present
    const fancyScreenButton = page.locator('button:has-text("SIGN IN WITH EMAIL"), button:has-text("Sign In")').first();
    const fancyScreenVisible = await fancyScreenButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (fancyScreenVisible) {
      await fancyScreenButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Request OTP
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    // Get OTP code from environment
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set. Run: pnpm setup:test-secrets in serverless/otp-auth-service');
    }
    
    // Verify OTP
    const { response } = await verifyOTPCode(page, otpCode);
    expect(response.ok()).toBeTruthy();
    
    // Wait for redirect after login
    await page.waitForURL(
      (url) => {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        return path === '/' || path.includes('/mods') || path.includes('/dashboard');
      },
      { timeout: 10000 }
    );
    
    // Wait for auth state to be persisted
    await page.waitForFunction(() => {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          return !!(parsed?.user?.token || parsed?.state?.user?.token);
        }
      } catch {
        return false;
      }
      return false;
    }, { timeout: 5000 });
    
    // Step 2: Collect console errors before navigating to upload
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });
    
    // Step 3: Navigate to upload page
    await page.goto(`${MODS_HUB_URL}/upload`, { waitUntil: 'networkidle' });
    
    // Wait for page to load and any API calls to complete
    await page.waitForTimeout(2000);
    
    // Step 4: Verify no token mismatch errors
    const tokenMismatchErrors = consoleErrors.filter(err => 
      err.includes('token mismatch') || 
      err.includes('Token mismatch') ||
      err.includes('decryption failed') ||
      err.includes('token does not match')
    );
    
    expect(tokenMismatchErrors.length).toBe(0);
    
    // Step 5: Verify customer association is present
    const authState = await page.evaluate(() => {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const customer = parsed?.user || parsed?.state?.user;
          return {
            hasUser: !!user,
            hasToken: !!user?.token,
            hasCustomerId: !!user?.customerId,
            customerId: user?.customerId || null,
            tokenLength: user?.token?.length || 0
          };
        }
      } catch {
        return null;
      }
      return null;
    });
    
    expect(authState).not.toBeNull();
    expect(authState?.hasUser).toBe(true);
    expect(authState?.hasToken).toBe(true);
    expect(authState?.hasCustomerId).toBe(true);
    expect(authState?.customerId).toBeTruthy();
    
    // Step 6: Verify upload page is accessible (not showing "Customer Account Required" error)
    const pageContent = await page.textContent('body');
    const hasCustomerError = pageContent?.includes('Customer Account Required') || 
                            pageContent?.includes('customer association') ||
                            pageContent?.includes('missing a customer');
    
    expect(hasCustomerError).toBe(false);
    
    // Step 7: Verify /auth/me call succeeded without errors
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/auth/me') && !response.ok()) {
        networkErrors.push(`Failed: ${response.status()} ${response.statusText()}`);
      }
    });
    
    // Trigger another /auth/me call by navigating away and back
    await page.goto(`${MODS_HUB_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.goto(`${MODS_HUB_URL}/upload`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    expect(networkErrors.length).toBe(0);
  });

  test('should extract customerId from JWT when /auth/me decryption fails', async ({ page }) => {
    // This test verifies the fallback mechanism works
    await page.goto(`${MODS_HUB_URL}/login`, { waitUntil: 'networkidle' });
    
    // Handle fancy screen
    const fancyScreenButton = page.locator('button:has-text("SIGN IN WITH EMAIL")').first();
    const fancyScreenVisible = await fancyScreenButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (fancyScreenVisible) {
      await fancyScreenButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Login
    await requestOTPCode(page, TEST_EMAIL);
    await waitForOTPForm(page);
    
    const otpCode = process.env.E2E_TEST_OTP_CODE;
    if (!otpCode) {
      throw new Error('E2E_TEST_OTP_CODE not set');
    }
    
    await verifyOTPCode(page, otpCode);
    
    // Wait for auth state
    await page.waitForURL(
      (url) => {
        const urlObj = new URL(url);
        return urlObj.pathname === '/' || urlObj.pathname.includes('/mods');
      },
      { timeout: 10000 }
    );
    
    await page.waitForFunction(() => {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          return !!(parsed?.user?.token || parsed?.state?.user?.token);
        }
      } catch {
        return false;
      }
      return false;
    }, { timeout: 5000 });
    
    // Extract token and verify it has customerId in JWT payload
    const tokenInfo = await page.evaluate(() => {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const customer = parsed?.user || parsed?.state?.user;
          const token = user?.token;
          
          if (token) {
            // Decode JWT payload
            const parts = token.split('.');
            if (parts.length === 3) {
              const payloadB64 = parts[1];
              const payload = JSON.parse(
                atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
              );
              
              return {
                hasToken: true,
                hasCustomerIdInJWT: !!payload?.customerId,
                customerIdFromJWT: payload?.customerId || null,
                customerIdFromUser: user?.customerId || null
              };
            }
          }
        }
      } catch (e) {
        return { error: String(e) };
      }
      return { hasToken: false };
    });
    
    expect(tokenInfo.hasToken).toBe(true);
    expect(tokenInfo.hasCustomerIdInJWT).toBe(true);
    expect(tokenInfo.customerIdFromJWT).toBeTruthy();
    
    // Navigate to upload - should work even if /auth/me fails
    await page.goto(`${MODS_HUB_URL}/upload`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Verify customerId is available in user object (either from /auth/me or extracted from JWT)
    const finalAuthState = await page.evaluate(() => {
      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          const customer = parsed?.user || parsed?.state?.user;
          return {
            hasCustomerId: !!user?.customerId,
            customerId: user?.customerId || null
          };
        }
      } catch {
        return null;
      }
      return null;
    });
    
    expect(finalAuthState?.hasCustomerId).toBe(true);
    expect(finalAuthState?.customerId).toBeTruthy();
  });
});
