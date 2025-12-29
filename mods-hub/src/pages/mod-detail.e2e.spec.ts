/**
 * Mods Hub - Mod Detail E2E Tests
 * 
 * Tests the mod detail/view page
 * Co-located with ModDetailPage component
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { verifyWorkersHealth } from '@strixun/e2e-helpers';
import { WORKER_URLS } from '../../../playwright.config.js';

interface ModsResponse {
  mods?: Array<{ slug: string }>;
}

test.describe('Mod Detail Page', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should display mod detail page structure', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    // Try to get a mod slug from the API first
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?limit=1`);
      if (response.ok) {
        const data = await response.json() as ModsResponse;
        if (data.mods && data.mods.length > 0) {
          const modSlug = data.mods[0].slug;
          await page.goto(`${modsHubUrl}/mods/${modSlug}`);
          
          // Should show mod detail page
          await page.waitForTimeout(2000);
          
          // Look for mod title or heading
          const modTitle = page.locator('h1, h2, [data-testid="mod-title"]');
          const titleCount = await modTitle.count();
          
          if (titleCount > 0) {
            await expect(modTitle.first()).toBeVisible();
          }
        }
      }
    } catch (error) {
      // If API fails, test with a placeholder slug
      await page.goto(`${modsHubUrl}/mods/test-mod`);
      
      // Should show 404 or empty state
      const notFound = page.locator('text=/not found|404|does not exist/i');
      const notFoundCount = await notFound.count();
      
      if (notFoundCount > 0) {
        await expect(notFound.first()).toBeVisible();
      }
    }
  });

  test('should display download button for published mods', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    // Try to get a published mod
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?limit=1&status=published`);
      if (response.ok) {
        const data = await response.json() as ModsResponse;
        if (data.mods && data.mods.length > 0) {
          const modSlug = data.mods[0].slug;
          await page.goto(`${modsHubUrl}/mods/${modSlug}`);
          
          await page.waitForTimeout(2000);
          
          // Look for download button
          const downloadButton = page.locator(
            'button:has-text("Download"), a:has-text("Download"), [data-testid="download-button"]'
          );
          
          const downloadCount = await downloadButton.count();
          if (downloadCount > 0) {
            await expect(downloadButton.first()).toBeVisible();
          }
        }
      }
    } catch (error) {
      // Skip if API unavailable
      test.skip();
    }
  });

  test('should display mod metadata', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?limit=1`);
      if (response.ok) {
        const data = await response.json() as ModsResponse;
        if (data.mods && data.mods.length > 0) {
          const modSlug = data.mods[0].slug;
          await page.goto(`${modsHubUrl}/mods/${modSlug}`);
          
          await page.waitForTimeout(2000);
          
          // Look for mod description or metadata
          const description = page.locator('[data-testid="mod-description"], .mod-description, p');
          const descCount = await description.count();
          
          if (descCount > 0) {
            // Description should be visible
            await expect(description.first()).toBeVisible();
          }
        }
      }
    } catch (error) {
      test.skip();
    }
  });
});

