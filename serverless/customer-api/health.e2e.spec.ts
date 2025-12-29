/**
 * Customer API Health Check E2E Tests
 * 
 * Verifies the Customer API worker is accessible and responding correctly
 * Co-located with the Customer API worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '../../../playwright.config';

test.describe('Customer API Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.CUSTOMER_API}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

