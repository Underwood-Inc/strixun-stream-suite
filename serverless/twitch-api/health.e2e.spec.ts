/**
 * Twitch API Health Check E2E Tests
 * 
 * Verifies the Twitch API worker is accessible and responding correctly
 * Co-located with the Twitch API worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Twitch API Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.TWITCH_API}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

