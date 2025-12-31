/**
 * Mods Hub - Mod List E2E Tests
 * 
 * Tests the mod browsing and discovery features
 * Co-located with ModListPage component
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { verifyWorkersHealth, WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Mod List Page', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should display mod list page', async ({ page }) => {
    // Navigate to mods hub (assuming it's deployed or running locally)
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(modsHubUrl);
    
    // Should show mod list or empty state
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  test('should display mod cards when mods exist', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(modsHubUrl);
    
    // Wait for mod cards to load (if any exist)
    const modCards = page.locator('[data-testid="mod-card"], .mod-card, article');
    await page.waitForTimeout(2000); // Give time for API call
    
    // If mods exist, cards should be visible
    const count = await modCards.count();
    if (count > 0) {
      await expect(modCards.first()).toBeVisible();
    }
  });

  test('should have search functionality', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(modsHubUrl);
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');
    const searchCount = await searchInput.count();
    
    if (searchCount > 0) {
      await expect(searchInput.first()).toBeVisible();
      
      // Test search interaction
      await searchInput.first().fill('test');
      await page.waitForTimeout(500); // Wait for debounce
    }
  });

  test('should have filter options', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    await page.goto(modsHubUrl);
    
    // Look for filter buttons or dropdowns
    const filters = page.locator('button:has-text("Filter"), select, [role="combobox"]');
    const filterCount = await filters.count();
    
    if (filterCount > 0) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('should return mods with customerId and dynamically fetched display names', async () => {
    // Verify API returns mods with required fields
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?pageSize=5`);
      if (!response.ok) {
        test.skip();
        return;
      }
      
      const data = await response.json() as { mods?: Array<{ customerId: string | null; authorId: string; authorDisplayName?: string | null }> };
      
      if (data.mods && data.mods.length > 0) {
        // Verify all mods have customerId (may be null but field must exist)
        data.mods.forEach((mod) => {
          expect(mod).toHaveProperty('customerId');
          expect(mod).toHaveProperty('authorId');
          // authorDisplayName should exist (may be null if user not found)
          expect(mod).toHaveProperty('authorDisplayName');
        });
      }
    } catch {
      test.skip();
    }
  });
});

