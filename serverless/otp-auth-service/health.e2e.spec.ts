/**
 * OTP Auth Service Health Check E2E Tests
 * 
 * Verifies the OTP Auth Service worker is accessible and responding correctly
 * Co-located with the OTP Auth Service worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '../../../playwright.config';

test.describe('OTP Auth Service Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.OTP_AUTH}/health`);
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });
});

