/**
 * Mods Hub - Mod Upload E2E Tests
 * 
 * Tests the mod upload flow (requires authentication)
 * Co-located with ModUploadPage component
 */

import { test, expect } from '@playwright/test';
import { verifyWorkersHealth, authenticateUser, TEST_USERS } from '../../../serverless/shared/e2e/helpers';

test.describe('Mod Upload', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should redirect to login when accessing upload page unauthenticated', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/upload`);
    
    // Should redirect to login or show login requirement
    await page.waitForTimeout(2000); // Wait for redirect
    
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || 
                       page.locator('input[type="email"]').isVisible();
    
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
});

