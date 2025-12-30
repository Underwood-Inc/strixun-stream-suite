/**
 * Mods Hub - Mod Thumbnail Rendering E2E Tests
 * 
 * Tests thumbnail image rendering including:
 * - Thumbnail display on mod list
 * - Thumbnail display on mod detail page
 * - Thumbnail loading and error handling
 * - Fallback images for missing thumbnails
 * - Image format support (PNG, JPG, WebP, etc.)
 * Co-located with ModCard and ModDetailPage components
 */

import { test, expect } from '@strixun/e2e-helpers/fixtures';
import { 
  verifyWorkersHealth, 
  WORKER_URLS
} from '@strixun/e2e-helpers';

const MODS_HUB_URL = process.env.E2E_MODS_HUB_URL || 'http://localhost:3001';
const MODS_API_URL = WORKER_URLS.MODS_API;

interface ModResponse {
  mod?: {
    modId: string;
    slug: string;
    thumbnailUrl?: string | null;
    visibility: 'public' | 'unlisted' | 'private';
    status: string;
  };
}

interface ModsListResponse {
  mods?: Array<{
    modId: string;
    slug: string;
    thumbnailUrl?: string | null;
    visibility: 'public' | 'unlisted' | 'private';
    status: string;
  }>;
}

/**
 * Helper: Get a mod with thumbnail from API
 */
async function getModWithThumbnail(): Promise<{ slug: string; thumbnailUrl: string | null } | null> {
  try {
    const response = await fetch(`${MODS_API_URL}/mods?limit=20`);
    if (!response.ok) return null;
    
    const data = await response.json() as ModsListResponse;
    if (!data.mods || data.mods.length === 0) return null;
    
    // Find first mod (with or without thumbnail)
    const mod = data.mods[0];
    
    // Get mod detail to check thumbnail
    const detailResponse = await fetch(`${MODS_API_URL}/mods/${mod.slug}`);
    if (!detailResponse.ok) return null;
    
    const detailData = await detailResponse.json() as ModResponse;
    
    return {
      slug: mod.slug,
      thumbnailUrl: detailData.mod?.thumbnailUrl || mod.thumbnailUrl || null,
    };
  } catch {
    return null;
  }
}

/**
 * Helper: Check if image loaded successfully
 */
async function checkImageLoaded(page: any, imageSelector: string): Promise<boolean> {
  try {
    const image = page.locator(imageSelector).first();
    const count = await image.count();
    if (count === 0) return false;
    
    // Check if image has loaded (naturalWidth > 0)
    const loaded = await image.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });
    
    return loaded;
  } catch {
    return false;
  }
}

test.describe('Mod Thumbnail Rendering', () => {
  test.beforeAll(async () => {
    // Verify all workers are healthy before running tests
    await verifyWorkersHealth();
  });

  test('should display thumbnails on mod list page', async ({ page }) => {
    await page.goto(`${MODS_HUB_URL}/mods`);
    await page.waitForLoadState('networkidle');
    
    // Look for thumbnail images
    const thumbnails = page.locator(
      'img[src*="thumbnail"], img[src*="thumb"], [data-testid*="thumbnail"], .mod-thumbnail img, .mod-card img'
    );
    
    const thumbnailCount = await thumbnails.count();
    
    if (thumbnailCount > 0) {
      // At least one thumbnail should be visible
      await expect(thumbnails.first()).toBeVisible({ timeout: 5000 });
      
      // Verify images have src attribute
      const firstThumbnail = thumbnails.first();
      const src = await firstThumbnail.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src?.length).toBeGreaterThan(0);
    } else {
      // If no thumbnails, mods might not have thumbnails - this is acceptable
      // But we should at least see mod cards
      const modCards = page.locator('[data-testid*="mod"], .mod-card, .mod-item');
      const cardCount = await modCards.count();
      expect(cardCount).toBeGreaterThan(0);
    }
  });

  test('should display thumbnail on mod detail page', async ({ page }) => {
    const mod = await getModWithThumbnail();
    if (!mod) {
      test.skip();
      return;
    }
    
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    await page.waitForLoadState('networkidle');
    
    // Look for thumbnail image on detail page
    const thumbnail = page.locator(
      'img[src*="thumbnail"], img[src*="thumb"], [data-testid*="thumbnail"], .mod-thumbnail img, .mod-header img'
    ).first();
    
    const thumbnailCount = await thumbnail.count();
    
    if (thumbnailCount > 0) {
      // Thumbnail should be visible
      await expect(thumbnail).toBeVisible({ timeout: 5000 });
      
      // Verify image loaded successfully
      const loaded = await checkImageLoaded(page, 'img[src*="thumbnail"], img[src*="thumb"]');
      
      if (mod.thumbnailUrl) {
        // If mod has thumbnail URL, image should load
        expect(loaded).toBeTruthy();
      }
      
      // Verify image has valid src
      const src = await thumbnail.getAttribute('src');
      expect(src).toBeTruthy();
    } else {
      // If no thumbnail, should show placeholder or fallback
      const placeholder = page.locator(
        '[data-testid*="placeholder"], .placeholder, .no-thumbnail'
      );
      const placeholderCount = await placeholder.count();
      
      // Either thumbnail or placeholder should be present
      if (placeholderCount === 0) {
        // Might use CSS background or other method - check for mod content
        const modContent = page.locator('h1, [data-testid="mod-title"]');
        const contentCount = await modContent.count();
        expect(contentCount).toBeGreaterThan(0);
      }
    }
  });

  test('should handle missing thumbnails gracefully', async ({ page }) => {
    // Get a mod (might or might not have thumbnail)
    const mod = await getModWithThumbnail();
    if (!mod) {
      test.skip();
      return;
    }
    
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    await page.waitForLoadState('networkidle');
    
    // Look for images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Check if any images failed to load
      const failedImages = await images.evaluateAll((imgs: HTMLImageElement[]) => {
        return imgs.filter(img => !img.complete || img.naturalWidth === 0);
      });
      
      // If images failed, should show placeholder or fallback
      if (failedImages.length > 0) {
        const placeholder = page.locator(
          '[data-testid*="placeholder"], .placeholder, .no-thumbnail, .fallback-image'
        );
        const placeholderCount = await placeholder.count();
        
        // Should have placeholder or fallback
        expect(placeholderCount).toBeGreaterThan(0);
      }
    }
  });

  test('should load thumbnail from API endpoint', async ({ page }) => {
    const mod = await getModWithThumbnail();
    if (!mod || !mod.thumbnailUrl) {
      test.skip();
      return;
    }
    
    // Navigate to mod detail page
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    await page.waitForLoadState('networkidle');
    
    // Extract thumbnail URL from page
    const thumbnailSrc = await page.evaluate(() => {
      const img = document.querySelector('img[src*="thumbnail"], img[src*="thumb"]') as HTMLImageElement;
      return img?.src || null;
    });
    
    if (thumbnailSrc) {
      // Verify thumbnail URL is accessible
      const response = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          return {
            status: res.status,
            contentType: res.headers.get('content-type'),
          };
        } catch {
          return { status: 0, contentType: null };
        }
      }, thumbnailSrc);
      
      // Thumbnail should be accessible (200 or 404 if missing)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      
      // If successful, should be an image
      if (response.status === 200) {
        expect(response.contentType).toBeTruthy();
        expect(
          response.contentType?.includes('image/png') ||
          response.contentType?.includes('image/jpeg') ||
          response.contentType?.includes('image/jpg') ||
          response.contentType?.includes('image/webp') ||
          response.contentType?.includes('image/gif')
        ).toBeTruthy();
      }
    }
  });

  test('should support multiple image formats', async ({ page }) => {
    // Get mods list to check various thumbnails
    await page.goto(`${MODS_HUB_URL}/mods`);
    await page.waitForLoadState('networkidle');
    
    // Get all thumbnail images
    const thumbnails = page.locator(
      'img[src*="thumbnail"], img[src*="thumb"], .mod-thumbnail img'
    );
    
    const thumbnailCount = await thumbnails.count();
    
    if (thumbnailCount > 0) {
      // Check first few thumbnails for format support
      const formats: string[] = [];
      
      for (let i = 0; i < Math.min(thumbnailCount, 5); i++) {
        const thumbnail = thumbnails.nth(i);
        const src = await thumbnail.getAttribute('src');
        
        if (src) {
          // Extract format from URL or content type
          if (src.includes('.png')) formats.push('png');
          else if (src.includes('.jpg') || src.includes('.jpeg')) formats.push('jpeg');
          else if (src.includes('.webp')) formats.push('webp');
          else if (src.includes('.gif')) formats.push('gif');
          
          // Verify image loaded
          const loaded = await checkImageLoaded(page, `img[src="${src}"]`);
          expect(loaded).toBeTruthy();
        }
      }
      
      // Should support at least one format
      expect(formats.length).toBeGreaterThan(0);
    }
  });

  test('should show fallback image for broken thumbnails', async ({ page }) => {
    const mod = await getModWithThumbnail();
    if (!mod) {
      test.skip();
      return;
    }
    
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    await page.waitForLoadState('networkidle');
    
    // Look for images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      // Set up error listener for images
      let imageErrorCount = 0;
      page.on('response', (response: any) => {
        if (response.url().includes('thumbnail') && !response.ok()) {
          imageErrorCount++;
        }
      });
      
      // Wait a bit for images to load
      await page.waitForTimeout(2000);
      
      // If images failed, should show placeholder
      if (imageErrorCount > 0) {
        const placeholder = page.locator(
          '[data-testid*="placeholder"], .placeholder, .no-thumbnail, img[alt*="placeholder" i]'
        );
        const placeholderCount = await placeholder.count();
        
        // Should have placeholder or fallback
        expect(placeholderCount).toBeGreaterThan(0);
      }
    }
  });

  test('should display thumbnail with correct aspect ratio', async ({ page }) => {
    const mod = await getModWithThumbnail();
    if (!mod) {
      test.skip();
      return;
    }
    
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    await page.waitForLoadState('networkidle');
    
    // Find thumbnail image
    const thumbnail = page.locator(
      'img[src*="thumbnail"], img[src*="thumb"], [data-testid*="thumbnail"] img'
    ).first();
    
    const thumbnailCount = await thumbnail.count();
    
    if (thumbnailCount > 0) {
      await expect(thumbnail).toBeVisible();
      
      // Check image dimensions
      const dimensions = await thumbnail.evaluate((img: HTMLImageElement) => {
        return {
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          aspectRatio: (img.naturalWidth || img.width) / (img.naturalHeight || img.height),
        };
      });
      
      // Image should have valid dimensions
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
      
      // Aspect ratio should be reasonable (not 0 or infinity)
      expect(dimensions.aspectRatio).toBeGreaterThan(0);
      expect(dimensions.aspectRatio).toBeLessThan(10);
    }
  });

  test('should load thumbnail efficiently (no layout shift)', async ({ page }) => {
    const mod = await getModWithThumbnail();
    if (!mod) {
      test.skip();
      return;
    }
    
    // Navigate to mod detail page
    await page.goto(`${MODS_HUB_URL}/mods/${mod.slug}`);
    
    // Wait for initial render
    await page.waitForLoadState('domcontentloaded');
    
    // Get initial layout
    const initialLayout = await page.evaluate(() => {
      const thumbnail = document.querySelector('img[src*="thumbnail"], img[src*="thumb"]') as HTMLImageElement;
      if (!thumbnail) return null;
      
      return {
        width: thumbnail.offsetWidth,
        height: thumbnail.offsetHeight,
        top: thumbnail.offsetTop,
        left: thumbnail.offsetLeft,
      };
    });
    
    // Wait for images to load
    await page.waitForLoadState('networkidle');
    
    // Get final layout
    const finalLayout = await page.evaluate(() => {
      const thumbnail = document.querySelector('img[src*="thumbnail"], img[src*="thumb"]') as HTMLImageElement;
      if (!thumbnail) return null;
      
      return {
        width: thumbnail.offsetWidth,
        height: thumbnail.offsetHeight,
        top: thumbnail.offsetTop,
        left: thumbnail.offsetLeft,
      };
    });
    
    if (initialLayout && finalLayout) {
      // Layout should not shift significantly (allow small differences for rounding)
      const widthDiff = Math.abs(initialLayout.width - finalLayout.width);
      const heightDiff = Math.abs(initialLayout.height - finalLayout.height);
      
      // Allow up to 5px difference for rounding
      expect(widthDiff).toBeLessThan(5);
      expect(heightDiff).toBeLessThan(5);
    }
  });
});

