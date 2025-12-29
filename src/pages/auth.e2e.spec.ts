/**
 * Authentication E2E Tests
 * 
 * Tests the complete authentication flow using OTP
 * Co-located with frontend auth code
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { verifyWorkersHealth } from '@strixun/e2e-helpers';

test.describe('Authentication Flow', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should display login screen on unauthenticated access', async ({ page }) => {
    await page.goto('/');
    
    // Should show login/auth UI
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
    await expect(loginButton).toBeVisible();
  });

  test('should request OTP when email is submitted', async ({ page }) => {
    await page.goto('/');
    
    // Find and click login
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }
    
    // Enter test email
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');
    
    // Submit OTP request
    const requestButton = page.locator('button:has-text("Send"), button:has-text("Request")').first();
    await requestButton.click();
    
    // Should show OTP input or success message
    const otpInput = page.locator('input[type="text"][inputmode="numeric"]');
    await expect(otpInput).toBeVisible({ timeout: 5000 });
  });

  test('should handle invalid OTP gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Navigate through auth flow to OTP input
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }
    
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');
    
    const requestButton = page.locator('button:has-text("Send"), button:has-text("Request")').first();
    await requestButton.click();
    
    // Wait for OTP input
    const otpInput = page.locator('input[type="text"][inputmode="numeric"]').first();
    await otpInput.waitFor({ state: 'visible' });
    
    // Enter invalid OTP
    await otpInput.fill('000000');
    
    // Submit
    const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Submit")').first();
    await verifyButton.click();
    
    // Should show error message
    const errorMessage = page.locator('text=/invalid|incorrect|error/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  // Note: Full OTP verification test requires integration with test email service
  // This would test the complete flow from email request to successful authentication
});

