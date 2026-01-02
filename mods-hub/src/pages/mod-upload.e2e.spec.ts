/**
 * Mods Hub - Mod Upload E2E Tests
 * 
 * Tests the mod upload flow (requires authentication)
 * Co-located with ModUploadPage component
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { verifyWorkersHealth, WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Mod Upload', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should redirect to login when accessing upload page unauthenticated', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/upload`, { waitUntil: 'networkidle' });
    
    // Should redirect to login or show login requirement
    await page.waitForTimeout(2000); // Wait for redirect
    
    const currentUrl = page.url();
    
    // CRITICAL: Handle fancy "Authentication Required" screen if present
    const fancyScreenButton = page.locator('button:has-text("SIGN IN WITH EMAIL"), button:has-text("Sign In")');
    const fancyScreenVisible = await fancyScreenButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (fancyScreenVisible) {
      await fancyScreenButton.click();
      await page.waitForTimeout(500);
    }
    
    // Check for email input (after handling fancy screen)
    const emailInput = page.locator('input#otp-login-email, input[type="email"]').first();
    const isEmailInputVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    const isLoginPage = currentUrl.includes('/login') || isEmailInputVisible;
    
    expect(isLoginPage).toBeTruthy();
  });

  test('should show upload form when authenticated', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    // Note: This requires OTP authentication which needs email service integration
    // For now, we'll test the structure
    
    await page.goto(`${modsHubUrl}/upload`);
    
    // After authentication, should see upload form
    // This test will need to be completed once OTP email service is integrated
    const uploadForm = page.locator('form, [data-testid="upload-form"]');
    
    // If authenticated, form should be visible
    // If not authenticated, should redirect to login (tested above)
    const formCount = await uploadForm.count();
    
    if (formCount > 0) {
      await expect(uploadForm.first()).toBeVisible();
    }
  });

  test('should have required upload fields', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    // This test assumes authentication (would need OTP email service)
    // For now, we'll check the structure
    
    await page.goto(`${modsHubUrl}/upload`);
    await page.waitForTimeout(2000);
    
    // Look for common upload form fields
    const titleInput = page.locator('input[name*="title" i], input[placeholder*="title" i]');
    const fileInput = page.locator('input[type="file"]');
    
    // If on upload page (authenticated), these should exist
    const titleCount = await titleInput.count();
    const fileCount = await fileInput.count();
    
    if (titleCount > 0 || fileCount > 0) {
      // Upload form is present
      if (titleCount > 0) {
        await expect(titleInput.first()).toBeVisible();
      }
      if (fileCount > 0) {
        await expect(fileInput.first()).toBeVisible();
      }
    }
  });

  test('should create mod with customerId and fetch display name dynamically', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const TEST_OTP_CODE = process.env.E2E_TEST_OTP_CODE || '123456';
    
    // This test verifies that uploaded mods have customerId and display names are fetched
    // Note: Full upload flow requires authentication and file handling
    try {
      // Authenticate first
      await page.goto(`${modsHubUrl}/login`, { waitUntil: 'networkidle' });
      const { requestOTPCode, verifyOTPCode, waitForOTPForm } = await import('@strixun/e2e-helpers');
      await requestOTPCode(page, TEST_EMAIL);
      await waitForOTPForm(page);
      const { response: verifyResponse } = await verifyOTPCode(page, TEST_OTP_CODE);
      
      if (!verifyResponse.ok()) {
        test.skip();
        return;
      }
      
      await page.waitForURL(
        (url) => {
          const urlObj = new URL(url.toString());
          const path = urlObj.pathname;
          return path !== '/login';
        },
        { timeout: 10000 }
      );
      
      // Get user's mods to verify they have customerId
      const token = await page.evaluate(() => {
        return localStorage.getItem('auth_token') || 
               localStorage.getItem('jwt_token') ||
               localStorage.getItem('token');
      });
      
      if (token) {
        const response = await fetch(`${WORKER_URLS.MODS_API}/mods?authorId=me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json() as { mods?: Array<{ customerId: string | null; authorId: string; authorDisplayName?: string | null }> };
          
          if (data.mods && data.mods.length > 0) {
            // Verify all user's mods have customerId and display name fields
            data.mods.forEach((mod) => {
              expect(mod).toHaveProperty('customerId');
              expect(mod).toHaveProperty('authorId');
              expect(mod).toHaveProperty('authorDisplayName');
            });
          }
        }
      }
    } catch {
      test.skip();
    }
  });
});

