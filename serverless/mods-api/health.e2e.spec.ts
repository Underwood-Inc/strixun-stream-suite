/**
 * Mods API Health Check E2E Tests
 * 
 * Verifies the Mods API worker is accessible and responding correctly
 * Co-located with the Mods API worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Mods API Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.MODS_API}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

