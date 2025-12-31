/**
 * Chat Signaling Health Check E2E Tests
 * 
 * Verifies the Chat Signaling worker is accessible and responding correctly
 * Co-located with the Chat Signaling worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Chat Signaling Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.CHAT_SIGNALING}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

