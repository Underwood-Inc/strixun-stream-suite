/**
 * Game API Health Check E2E Tests
 * 
 * Verifies the Game API worker is accessible and responding correctly
 * Co-located with the Game API worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Game API Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.GAME_API}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

