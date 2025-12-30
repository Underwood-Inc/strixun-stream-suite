/**
 * URL Shortener Health Check E2E Tests
 * 
 * Verifies the URL Shortener worker is accessible and responding correctly
 * Co-located with the URL Shortener worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('URL Shortener Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.URL_SHORTENER}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

