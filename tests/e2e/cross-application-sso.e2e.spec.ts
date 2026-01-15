/**
 * Cross-Application SSO E2E Tests
 * 
 * Tests true Single Sign-On across all .idling.app applications
 * CRITICAL: Verifies HttpOnly cookie is shared across subdomains
 * 
 * Applications Tested:
 * - auth.idling.app (OTP Auth Service)
 * - mods.idling.app (Mods Hub)
 * - shorten.idling.app (URL Shortener)
 * - suite.idling.app (Stream Suite)
 * 
 * Key Features:
 * 1. Login once on auth.idling.app → authenticated everywhere
 * 2. Cookie Domain=.idling.app enables cross-subdomain sharing
 * 3. Logout on any app → logged out everywhere
 * 4. Session persists across tabs and windows
 */

import { test, expect, Browser, Page } from '@playwright/test';

// Application URLs - update for your environment
const AUTH_URL = process.env.E2E_AUTH_URL || 'https://auth.idling.app';
const MODS_HUB_URL = process.env.E2E_MODS_HUB_URL || 'https://mods.idling.app';
const URL_SHORTENER_URL = process.env.E2E_URL_SHORTENER_URL || 'https://shorten.idling.app';
const STREAM_SUITE_URL = process.env.E2E_STREAM_SUITE_URL || 'https://suite.idling.app';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_OTP_CODE = process.env.E2E_TEST_OTP_CODE;

if (!TEST_OTP_CODE) {
  console.warn('⚠ E2E_TEST_OTP_CODE not set - SSO E2E tests will be skipped');
}

/**
 * Helper: Get auth_token cookie from browser context
 */
async function getAuthCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  return authCookie?.value || null;
}

/**
 * Helper: Login on OTP Auth Service
 */
async function loginOnAuthService(page: Page): Promise<void> {
  await page.goto(`${AUTH_URL}/login`);
  
  // Request OTP
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL);
  
  const requestButton = page.locator('button:has-text("Send"), button:has-text("Request")').first();
  await requestButton.click();
  
  // Enter OTP
  const otpInput = page.locator('input[type="tel"], input[type="text"][inputmode="numeric"]').first();
  await otpInput.waitFor({ state: 'visible', timeout: 10000 });
  await otpInput.fill(TEST_OTP_CODE!);
  
  const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Login")').first();
  await verifyButton.click();
  
  // Wait for successful login (redirect or success message)
  await page.waitForTimeout(2000);
}

/**
 * Helper: Check if user is authenticated on a page
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check if auth screen is NOT visible
    const authScreen = page.locator('.auth-screen, .login-screen, [data-auth="required"]').first();
    const authScreenVisible = await authScreen.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (authScreenVisible) {
      return false; // Auth screen is visible = not authenticated
    }
    
    // Check for authenticated elements (profile button, logout button, etc.)
    const authElement = page.locator(
      '[data-auth="authenticated"], button:has-text("Logout"), button:has-text("Sign Out"), [title*="Profile" i]'
    ).first();
    const authElementVisible = await authElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    return authElementVisible; // If we see logout/profile = authenticated
  } catch {
    return false;
  }
}

test.describe.skipIf(!TEST_OTP_CODE)('Cross-Application SSO', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all cookies before each test
    await page.context().clearCookies();
  });

  test('should share authentication across all apps after single login', async ({ browser }) => {
    // Create browser context
    const context = await browser.newContext();
    
    // Step 1: Login on auth.idling.app
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    // Verify cookie is set with correct domain
    const authCookie = await getAuthCookie(authPage);
    expect(authCookie).toBeTruthy();
    
    const cookies = await context.cookies();
    const authCookieDetails = cookies.find(c => c.name === 'auth_token');
    expect(authCookieDetails).toBeDefined();
    expect(authCookieDetails?.domain).toBe('.idling.app'); // CRITICAL: Root domain
    expect(authCookieDetails?.httpOnly).toBe(true);
    expect(authCookieDetails?.secure).toBe(true);
    
    // Step 2: Open Mods Hub - should be automatically authenticated
    const modsPage = await context.newPage();
    await modsPage.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const modsAuthenticated = await isAuthenticated(modsPage);
    expect(modsAuthenticated).toBe(true);
    
    // Verify same cookie is present
    const modsCookie = await getAuthCookie(modsPage);
    expect(modsCookie).toBe(authCookie);
    
    // Step 3: Open URL Shortener - should be automatically authenticated
    const shortenerPage = await context.newPage();
    await shortenerPage.goto(URL_SHORTENER_URL, { waitUntil: 'networkidle' });
    
    const shortenerAuthenticated = await isAuthenticated(shortenerPage);
    expect(shortenerAuthenticated).toBe(true);
    
    const shortenerCookie = await getAuthCookie(shortenerPage);
    expect(shortenerCookie).toBe(authCookie);
    
    // Step 4: Open Stream Suite - should be automatically authenticated
    const suitePage = await context.newPage();
    await suitePage.goto(STREAM_SUITE_URL, { waitUntil: 'networkidle' });
    
    const suiteAuthenticated = await isAuthenticated(suitePage);
    expect(suiteAuthenticated).toBe(true);
    
    const suiteCookie = await getAuthCookie(suitePage);
    expect(suiteCookie).toBe(authCookie);
    
    // Cleanup
    await authPage.close();
    await modsPage.close();
    await shortenerPage.close();
    await suitePage.close();
    await context.close();
  });

  test('should logout from all apps when logging out from one app', async ({ browser }) => {
    // Create browser context
    const context = await browser.newContext();
    
    // Step 1: Login
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    const authCookie = await getAuthCookie(authPage);
    expect(authCookie).toBeTruthy();
    
    // Step 2: Open multiple apps
    const modsPage = await context.newPage();
    await modsPage.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const suitePages = await context.newPage();
    await suitePage.goto(STREAM_SUITE_URL, { waitUntil: 'networkidle' });
    
    // Verify both are authenticated
    const modsAuth1 = await isAuthenticated(modsPage);
    const suiteAuth1 = await isAuthenticated(suitePage);
    expect(modsAuth1).toBe(true);
    expect(suiteAuth1).toBe(true);
    
    // Step 3: Logout from Mods Hub
    const logoutButton = modsPage.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
    await logoutButton.click();
    
    // Wait for logout to complete
    await modsPage.waitForTimeout(2000);
    
    // Step 4: Verify cookie is cleared
    const cookieAfterLogout = await getAuthCookie(modsPage);
    expect(cookieAfterLogout).toBeFalsy();
    
    // Step 5: Refresh Stream Suite - should be logged out
    await suitePage.reload({ waitUntil: 'networkidle' });
    
    const suiteAuth2 = await isAuthenticated(suitePage);
    expect(suiteAuth2).toBe(false); // Should be logged out
    
    const suiteCookie = await getAuthCookie(suitePage);
    expect(suiteCookie).toBeFalsy(); // Cookie should be gone
    
    // Cleanup
    await authPage.close();
    await modsPage.close();
    await suitePage.close();
    await context.close();
  });

  test('should persist session across page reloads on all apps', async ({ browser }) => {
    const context = await browser.newContext();
    
    // Login
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    const cookieBefore = await getAuthCookie(authPage);
    expect(cookieBefore).toBeTruthy();
    
    // Open multiple apps
    const modsPage = await context.newPage();
    await modsPage.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const suitePage = await context.newPage();
    await suitePage.goto(STREAM_SUITE_URL, { waitUntil: 'networkidle' });
    
    // Reload all apps
    await modsPage.reload({ waitUntil: 'networkidle' });
    await suitePage.reload({ waitUntil: 'networkidle' });
    
    // Verify still authenticated
    const modsAuth = await isAuthenticated(modsPage);
    const suiteAuth = await isAuthenticated(suitePage);
    expect(modsAuth).toBe(true);
    expect(suiteAuth).toBe(true);
    
    // Verify cookie persists
    const modsCookie = await getAuthCookie(modsPage);
    const suiteCookie = await getAuthCookie(suitePage);
    expect(modsCookie).toBe(cookieBefore);
    expect(suiteCookie).toBe(cookieBefore);
    
    // Cleanup
    await authPage.close();
    await modsPage.close();
    await suitePage.close();
    await context.close();
  });

  test('should share session across multiple tabs of same app', async ({ browser }) => {
    const context = await browser.newContext();
    
    // Login
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    const authCookie = await getAuthCookie(authPage);
    expect(authCookie).toBeTruthy();
    
    // Open multiple tabs of Mods Hub
    const modsTab1 = await context.newPage();
    await modsTab1.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const modsTab2 = await context.newPage();
    await modsTab2.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const modsTab3 = await context.newPage();
    await modsTab3.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    // Verify all tabs are authenticated
    const tab1Auth = await isAuthenticated(modsTab1);
    const tab2Auth = await isAuthenticated(modsTab2);
    const tab3Auth = await isAuthenticated(modsTab3);
    expect(tab1Auth).toBe(true);
    expect(tab2Auth).toBe(true);
    expect(tab3Auth).toBe(true);
    
    // Verify all tabs have same cookie
    const tab1Cookie = await getAuthCookie(modsTab1);
    const tab2Cookie = await getAuthCookie(modsTab2);
    const tab3Cookie = await getAuthCookie(modsTab3);
    expect(tab1Cookie).toBe(authCookie);
    expect(tab2Cookie).toBe(authCookie);
    expect(tab3Cookie).toBe(authCookie);
    
    // Logout from one tab
    const logoutButton = modsTab1.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
    await logoutButton.click();
    await modsTab1.waitForTimeout(2000);
    
    // Reload other tabs - should be logged out
    await modsTab2.reload({ waitUntil: 'networkidle' });
    await modsTab3.reload({ waitUntil: 'networkidle' });
    
    const tab2AuthAfter = await isAuthenticated(modsTab2);
    const tab3AuthAfter = await isAuthenticated(modsTab3);
    expect(tab2AuthAfter).toBe(false);
    expect(tab3AuthAfter).toBe(false);
    
    // Cleanup
    await authPage.close();
    await modsTab1.close();
    await modsTab2.close();
    await modsTab3.close();
    await context.close();
  });

  test('should handle cookie expiration across all apps', async ({ browser }) => {
    const context = await browser.newContext();
    
    // Login
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    // Open apps
    const modsPage = await context.newPage();
    await modsPage.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const suitePage = await context.newPage();
    await suitePage.goto(STREAM_SUITE_URL, { waitUntil: 'networkidle' });
    
    // Manually expire the cookie
    await context.addCookies([{
      name: 'auth_token',
      value: 'expired',
      domain: '.idling.app',
      path: '/',
      expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    
    // Reload apps - should be logged out
    await modsPage.reload({ waitUntil: 'networkidle' });
    await suitePage.reload({ waitUntil: 'networkidle' });
    
    const modsAuth = await isAuthenticated(modsPage);
    const suiteAuth = await isAuthenticated(suitePage);
    expect(modsAuth).toBe(false);
    expect(suiteAuth).toBe(false);
    
    // Cleanup
    await authPage.close();
    await modsPage.close();
    await suitePage.close();
    await context.close();
  });

  test('should NOT leak auth token to localStorage on any app', async ({ browser }) => {
    const context = await browser.newContext();
    
    // Login
    const authPage = await context.newPage();
    await loginOnAuthService(authPage);
    
    // Check auth service
    const authLocalStorage = await authPage.evaluate(() => {
      const tokens: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('jwt'))) {
          const value = localStorage.getItem(key);
          if (value && value.length > 50 && value.includes('.')) {
            tokens.push(key);
          }
        }
      }
      return tokens;
    });
    expect(authLocalStorage.length).toBe(0);
    
    // Check Mods Hub
    const modsPage = await context.newPage();
    await modsPage.goto(MODS_HUB_URL, { waitUntil: 'networkidle' });
    
    const modsLocalStorage = await modsPage.evaluate(() => {
      const tokens: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('jwt'))) {
          const value = localStorage.getItem(key);
          if (value && value.length > 50 && value.includes('.')) {
            tokens.push(key);
          }
        }
      }
      return tokens;
    });
    expect(modsLocalStorage.length).toBe(0);
    
    // Check Stream Suite
    const suitePage = await context.newPage();
    await suitePage.goto(STREAM_SUITE_URL, { waitUntil: 'networkidle' });
    
    const suiteLocalStorage = await suitePage.evaluate(() => {
      const tokens: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('token') || key.includes('jwt'))) {
          const value = localStorage.getItem(key);
          if (value && value.length > 50 && value.includes('.')) {
            tokens.push(key);
          }
        }
      }
      return tokens;
    });
    expect(suiteLocalStorage.length).toBe(0);
    
    // Cleanup
    await authPage.close();
    await modsPage.close();
    await suitePage.close();
    await context.close();
  });
});
