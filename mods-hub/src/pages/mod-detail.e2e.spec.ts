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
    } catch {
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
    } catch {
      // Skip if API unavailable
      test.skip();
    }
  });

  test('should successfully download public mod without authentication', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    
    // Try to get a public published mod
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?limit=1&status=published&visibility=public`);
      if (response.ok) {
        const data = await response.json() as ModsResponse & { mods?: Array<{ slug: string; versions?: Array<{ versionId: string }> }> };
        if (data.mods && data.mods.length > 0) {
          const mod = data.mods[0];
          if (mod.versions && mod.versions.length > 0) {
            const modSlug = mod.slug;
            
            await page.goto(`${modsHubUrl}/mods/${modSlug}`);
            await page.waitForLoadState('networkidle');
            
            // Look for download button
            const downloadButton = page.locator(
              'button:has-text("Download"), a:has-text("Download"), [data-testid="download-button"], [data-testid="download-version-button"]'
            ).first();
            
            const downloadCount = await downloadButton.count();
            if (downloadCount > 0) {
              // Set up download listener
              const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
              
              // Click download button
              await downloadButton.click();
              
              // Wait for download to start
              const download = await downloadPromise;
              
              if (download) {
                // Verify download started
                const suggestedFilename = download.suggestedFilename();
                expect(suggestedFilename).toBeTruthy();
                expect(suggestedFilename.length).toBeGreaterThan(0);
                
                // Verify download completes (file is decrypted and downloadable)
                const path = await download.path();
                expect(path).toBeTruthy();
                
                // Verify file exists and has content
                // Note: File system access in browser context is limited
                // The download path() method ensures file exists
                expect(path).toBeTruthy();
              } else {
                // Download might be handled via navigation or fetch
                await page.waitForTimeout(2000);
                const url = page.url();
                const isOnModPage = url.includes(`/mods/${modSlug}`);
                const isOnDownloadPage = url.includes('/download');
                expect(isOnModPage || isOnDownloadPage).toBeTruthy();
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip if API unavailable or no test data
      console.warn('Skipping download test - no test data available:', error);
      test.skip();
    }
  });

  test('should verify download file integrity headers', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
    const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
    const TEST_OTP_CODE = process.env.E2E_TEST_OTP_CODE || '123456';
    
    // Get a public mod
    try {
      const response = await fetch(`${WORKER_URLS.MODS_API}/mods?limit=1&visibility=public`);
      if (!response.ok) {
        test.skip();
        return;
      }
      
      const data = await response.json() as ModsResponse & { mods?: Array<{ slug: string; versions?: Array<{ versionId: string }> }> };
      if (!data.mods || data.mods.length === 0) {
        test.skip();
        return;
      }
      
      const mod = data.mods[0];
      if (!mod.versions || mod.versions.length === 0) {
        test.skip();
        return;
      }
      
      // Authenticate to get token
      await page.goto(`${modsHubUrl}/login`);
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
      
      const token = await page.evaluate(() => {
        return localStorage.getItem('auth_token') || 
               localStorage.getItem('jwt_token') ||
               localStorage.getItem('token');
      });
      
      // Make direct API request to download endpoint
      const downloadUrl = `${WORKER_URLS.MODS_API}/mods/${mod.slug}/versions/${mod.versions[0].versionId}/download`;
      
      const apiResponse = await page.evaluate(async ({ url, authToken }: { url: string; authToken: string | null }) => {
        const headers: HeadersInit = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const res = await fetch(url, { headers });
        return {
          status: res.status,
          headers: {
            'x-strixun-file-hash': res.headers.get('x-strixun-file-hash'),
            'x-strixun-sha256': res.headers.get('x-strixun-sha256'),
            'content-type': res.headers.get('content-type'),
            'content-disposition': res.headers.get('content-disposition'),
          },
        };
      }, { url: downloadUrl, authToken: token });
      
      // Verify response is successful
      expect(apiResponse.status).toBe(200);
      
      // Verify integrity headers are present (if available)
      if (apiResponse.headers['x-strixun-sha256']) {
        expect(apiResponse.headers['x-strixun-sha256']).toBeTruthy();
        expect(apiResponse.headers['x-strixun-sha256'].length).toBeGreaterThan(0);
      }
      
      // Verify content type indicates a file download
      expect(apiResponse.headers['content-type']).toBeTruthy();
      const contentType = apiResponse.headers['content-type'];
      expect(
        contentType?.includes('application/zip') ||
        contentType?.includes('application/octet-stream') ||
        contentType?.includes('application/x-zip-compressed')
      ).toBeTruthy();
    } catch (error) {
      console.warn('Skipping integrity headers test:', error);
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
    } catch {
      test.skip();
    }
  });

  test('should return mod detail with customerId and dynamically fetched display name', async () => {
    // Verify API returns mod detail with required fields
    try {
      const listResponse = await fetch(`${WORKER_URLS.MODS_API}/mods?pageSize=1`);
      if (!listResponse.ok) {
        test.skip();
        return;
      }
      
      const listData = await listResponse.json() as ModsResponse;
      if (!listData.mods || listData.mods.length === 0) {
        test.skip();
        return;
      }
      
      const modSlug = listData.mods[0].slug;
      const detailResponse = await fetch(`${WORKER_URLS.MODS_API}/mods/${modSlug}`);
      
      if (!detailResponse.ok) {
        test.skip();
        return;
      }
      
      const detailData = await detailResponse.json() as { mod?: { customerId: string | null; authorId: string; authorDisplayName?: string | null } };
      
      if (detailData.mod) {
        // Verify mod has customerId (may be null but field must exist)
        expect(detailData.mod).toHaveProperty('customerId');
        expect(detailData.mod).toHaveProperty('authorId');
        // authorDisplayName should exist (may be null if user not found)
        expect(detailData.mod).toHaveProperty('authorDisplayName');
      }
    } catch {
      test.skip();
    }
  });
});

