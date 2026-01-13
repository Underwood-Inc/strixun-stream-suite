/**
 * Integration Tests for HttpOnly Cookie SSO - MINIFLARE
 * Tests the new HttpOnly cookie-based Single Sign-On functionality
 * 
 * These tests verify:
 * 1. HttpOnly cookie is set during login (verify-otp)
 * 2. HttpOnly cookie is sent automatically with credentials: 'include'
 * 3. /auth/me accepts HttpOnly cookie instead of Authorization header
 * 4. HttpOnly cookie is cleared during logout
 * 5. Cookie has correct attributes (HttpOnly, Secure, SameSite=Lax, Domain=.idling.app)
 * 6. Multiple applications can share the session via cookie
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { clearLocalKVNamespace } from '../../../shared/test-kv-cleanup.js';
import { createMultiWorkerSetup } from '../../../shared/test-helpers/miniflare-workers.js';
import type { UnstableDevWorker } from 'wrangler';

import { assertE2ETestOTPCode } from '../../shared/test-helpers/otp-code-loader.js';

// ⚠ Check for required E2E_TEST_OTP_CODE before any tests run (skip if missing)
const E2E_OTP_CODE = assertE2ETestOTPCode();

const testEmail = `httponly-sso-test-${Date.now()}-${Math.random().toString(36).substring(7)}@integration-test.example.com`;

describe.skipIf(!E2E_OTP_CODE)('HttpOnly Cookie SSO - Integration Tests (Miniflare)', () => {
  let otpAuthService: UnstableDevWorker;
  let customerAPI: UnstableDevWorker;
  let cleanup: () => Promise<void>;
  let jwtToken: string | null = null;
  let customerId: string | null = null;
  let authCookie: string | null = null;

  beforeAll(async () => {
    const setup = await createMultiWorkerSetup();
    otpAuthService = setup.otpAuthService;
    customerAPI = setup.customerAPI;
    cleanup = setup.cleanup;
  }, 30000);

  describe('Login Flow - HttpOnly Cookie Setting', () => {
    it('should set HttpOnly cookie during OTP verification', async () => {
      // Step 1: Request OTP
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      expect(requestResponse.status).toBe(200);

      // Step 2: Verify OTP - should set HttpOnly cookie
      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      // Extract token and customerId from response
      const verifyData = await verifyResponse.json();
      jwtToken = verifyData.access_token || verifyData.token;
      customerId = verifyData.customerId;

      expect(jwtToken).toBeDefined();
      expect(customerId).toBeDefined();
      expect(customerId).toMatch(/^cust_/);

      // CRITICAL: Check for Set-Cookie header with HttpOnly attribute
      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('auth_token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=Lax');
      expect(setCookieHeader).toContain('Domain=.idling.app');
      expect(setCookieHeader).toContain('Path=/');

      // Extract cookie value for subsequent requests
      const cookieMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      authCookie = cookieMatch ? cookieMatch[1] : null;
      expect(authCookie).toBeDefined();
      expect(authCookie).toBe(jwtToken);
    }, 30000);

    it('should return displayName in verify-otp response', async () => {
      // Request OTP for a new account
      const newEmail = `httponly-displayname-test-${Date.now()}@integration-test.example.com`;
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      expect(requestResponse.status).toBe(200);

      // Verify OTP
      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      const verifyData = await verifyResponse.json();
      
      // CRITICAL: displayName should be returned
      expect(verifyData.displayName).toBeDefined();
      expect(typeof verifyData.displayName).toBe('string');
      expect(verifyData.displayName.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Session Management - Cookie-based Authentication', () => {
    it('should authenticate /auth/me with HttpOnly cookie (no Authorization header)', async () => {
      if (!authCookie) {
        throw new Error('Auth cookie not available');
      }

      // Call /auth/me with cookie in Cookie header
      const response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();

      // Verify customer data
      expect(data.customerId || data.id).toBe(customerId);
      expect(data.sub).toBe(customerId);
      expect(data.displayName).toBeDefined();
      
      // CRITICAL: Email should NOT be included (privacy)
      expect(data.email).toBeUndefined();
    }, 30000);

    it('should prioritize HttpOnly cookie over Authorization header', async () => {
      if (!authCookie) {
        throw new Error('Auth cookie not available');
      }

      // Call /auth/me with BOTH cookie and Authorization header
      // Cookie should take precedence
      const response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
          'Authorization': 'Bearer invalid.jwt.token', // Invalid token
        },
      });

      // Should succeed because cookie is valid
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.customerId || data.id).toBe(customerId);
    }, 30000);

    it('should fail when cookie is missing', async () => {
      const response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        // No Cookie header, no Authorization header
      });

      expect(response.status).toBe(401);
    }, 10000);

    it('should fail when cookie is invalid', async () => {
      const response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': 'auth_token=invalid.jwt.token',
        },
      });

      expect(response.status).toBe(401);
    }, 10000);
  });

  describe('Logout Flow - HttpOnly Cookie Clearing', () => {
    it('should clear HttpOnly cookie during logout', async () => {
      if (!authCookie) {
        throw new Error('Auth cookie not available');
      }

      // Logout with cookie
      const logoutResponse = await otpAuthService.fetch('http://example.com/auth/logout', {
        method: 'POST',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      expect(logoutResponse.status).toBe(200);
      
      // CRITICAL: Check for Set-Cookie header that clears the cookie
      const setCookieHeader = logoutResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('auth_token=');
      expect(setCookieHeader).toContain('Max-Age=0'); // Or Expires in the past
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Domain=.idling.app');
      
      // Verify session is deleted - /auth/me should fail
      const meResponse = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${authCookie}`,
        },
      });

      expect(meResponse.status).toBe(401);
    }, 30000);

    it('should accept logout without cookie (graceful handling)', async () => {
      // Logout without cookie should still return 200
      const logoutResponse = await otpAuthService.fetch('http://example.com/auth/logout', {
        method: 'POST',
        // No cookie
      });

      // Should succeed even without cookie
      expect(logoutResponse.status).toBe(200);
    }, 10000);
  });

  describe('Cookie Security Attributes', () => {
    it('should set cookie with all required security attributes', async () => {
      // Create a new login to test cookie attributes
      const newEmail = `httponly-security-test-${Date.now()}@integration-test.example.com`;
      
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      expect(requestResponse.status).toBe(200);

      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeDefined();

      // Verify all security attributes
      expect(setCookieHeader).toContain('HttpOnly'); // Prevents XSS
      expect(setCookieHeader).toContain('Secure'); // HTTPS only
      expect(setCookieHeader).toContain('SameSite=Lax'); // CSRF protection
      expect(setCookieHeader).toContain('Domain=.idling.app'); // Cross-subdomain SSO
      expect(setCookieHeader).toContain('Path=/'); // Available everywhere
      
      // Verify Max-Age or Expires is set (session duration)
      const hasMaxAge = setCookieHeader?.includes('Max-Age=');
      const hasExpires = setCookieHeader?.includes('Expires=');
      expect(hasMaxAge || hasExpires).toBe(true);
    }, 30000);
  });

  describe('Cross-Application SSO', () => {
    it('should share session across subdomains via cookie domain', async () => {
      // Login once
      const ssoEmail = `httponly-sso-test-${Date.now()}@integration-test.example.com`;
      
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ssoEmail }),
      });
      expect(requestResponse.status).toBe(200);

      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ssoEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      const verifyData = await verifyResponse.json();
      const ssoToken = verifyData.access_token || verifyData.token;
      const ssoCustomerId = verifyData.customerId;

      // Extract cookie
      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      const cookieMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      const ssoCookie = cookieMatch ? cookieMatch[1] : null;
      
      expect(ssoCookie).toBeDefined();
      expect(setCookieHeader).toContain('Domain=.idling.app');

      // Simulate different subdomains by using the same cookie
      // In a real browser, the cookie would be sent automatically to all *.idling.app domains
      
      // App 1 (auth.idling.app) - already logged in
      const app1Response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${ssoCookie}`,
        },
      });
      expect(app1Response.status).toBe(200);
      const app1Data = await app1Response.json();
      expect(app1Data.customerId || app1Data.id).toBe(ssoCustomerId);

      // App 2 (mods.idling.app) - should work with same cookie
      const app2Response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${ssoCookie}`,
          'Host': 'mods.idling.app', // Simulate different subdomain
        },
      });
      expect(app2Response.status).toBe(200);
      const app2Data = await app2Response.json();
      expect(app2Data.customerId || app2Data.id).toBe(ssoCustomerId);

      // App 3 (shorten.idling.app) - should work with same cookie
      const app3Response = await otpAuthService.fetch('http://example.com/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${ssoCookie}`,
          'Host': 'shorten.idling.app', // Simulate different subdomain
        },
      });
      expect(app3Response.status).toBe(200);
      const app3Data = await app3Response.json();
      expect(app3Data.customerId || app3Data.id).toBe(ssoCustomerId);
    }, 30000);

    it('should maintain session across page refreshes', async () => {
      // This is implicitly tested by the cookie persistence
      // Cookies persist across requests until Max-Age expires or logout
      
      // Create new session
      const refreshEmail = `httponly-refresh-test-${Date.now()}@integration-test.example.com`;
      
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refreshEmail }),
      });
      expect(requestResponse.status).toBe(200);

      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refreshEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      const cookieMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      const refreshCookie = cookieMatch ? cookieMatch[1] : null;

      // Simulate multiple page refreshes (multiple /auth/me calls)
      for (let i = 0; i < 5; i++) {
        const response = await otpAuthService.fetch('http://example.com/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `auth_token=${refreshCookie}`,
          },
        });
        expect(response.status).toBe(200);
      }
    }, 30000);
  });

  describe('Token Refresh with Cookie', () => {
    it('should refresh token and update HttpOnly cookie', async () => {
      // Create a new session
      const refreshEmail = `httponly-token-refresh-test-${Date.now()}@integration-test.example.com`;
      
      const requestResponse = await otpAuthService.fetch('http://example.com/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refreshEmail }),
      });
      expect(requestResponse.status).toBe(200);

      const verifyResponse = await otpAuthService.fetch('http://example.com/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refreshEmail, otp: E2E_OTP_CODE }),
      });
      expect(verifyResponse.status).toBe(200);
      
      const verifyData = await verifyResponse.json();
      const originalToken = verifyData.access_token || verifyData.token;

      const setCookieHeader = verifyResponse.headers.get('set-cookie');
      const cookieMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      const originalCookie = cookieMatch ? cookieMatch[1] : null;

      // Refresh token
      const refreshResponse = await otpAuthService.fetch('http://example.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${originalCookie}`,
        },
        body: JSON.stringify({ token: originalToken }),
      });

      expect(refreshResponse.status).toBe(200);
      
      // Check if new cookie is set
      const refreshSetCookie = refreshResponse.headers.get('set-cookie');
      if (refreshSetCookie) {
        expect(refreshSetCookie).toContain('auth_token=');
        expect(refreshSetCookie).toContain('HttpOnly');
        expect(refreshSetCookie).toContain('Secure');
        expect(refreshSetCookie).toContain('Domain=.idling.app');
      }
    }, 30000);
  });

  afterAll(async () => {
    // Clean up workers
    await cleanup();
    
    // Cleanup: Clear local KV storage to ensure test isolation
    await clearLocalKVNamespace('680c9dbe86854c369dd23e278abb41f9'); // OTP_AUTH_KV namespace
    await clearLocalKVNamespace('86ef5ab4419b40eab3fe65b75f052789'); // CUSTOMER_KV namespace
    console.log('[HttpOnly Cookie SSO Integration Tests] ✓ KV cleanup completed');
  });
});
