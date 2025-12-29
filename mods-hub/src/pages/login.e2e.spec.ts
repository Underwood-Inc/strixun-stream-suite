/**
 * Mods Hub - Login E2E Tests
 * 
 * Tests the authentication flow for mods-hub
 * Co-located with LoginPage component
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { verifyWorkersHealth } from '@strixun/e2e-helpers';

test.describe('Mods Hub Login', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should display login page', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/login`);
    
    // Should show login form or OTP login component
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('should allow email input for OTP request', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/login`);
    
    // Find email input
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible' });
    
    // Enter test email
    await emailInput.fill('test@example.com');
    
    // Verify email was entered
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('should have submit button for OTP request', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/login`);
    
    // Look for submit/request button
    const submitButton = page.locator(
      'button:has-text("Send"), button:has-text("Request"), button[type="submit"]'
    ).first();
    
    await expect(submitButton).toBeVisible({ timeout: 5000 });
  });

  test('should handle OTP input after request', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(`${modsHubUrl}/login`);
    
    // Enter email and submit
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');
    
    const submitButton = page.locator(
      'button:has-text("Send"), button:has-text("Request"), button[type="submit"]'
    ).first();
    await submitButton.click();
    
    // Wait for OTP input to appear
    const otpInput = page.locator(
      'input[type="text"][inputmode="numeric"], input[name*="otp" i]'
    );
    
    // OTP input should appear (may take a moment)
    await expect(otpInput).toBeVisible({ timeout: 5000 });
  });
});

