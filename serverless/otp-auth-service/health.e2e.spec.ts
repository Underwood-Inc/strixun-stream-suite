/**
 * OTP Auth Service Health Check E2E Tests
 * 
 * Verifies the OTP Auth Service worker is accessible and responding correctly
 * Co-located with the OTP Auth Service worker
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('OTP Auth Service Health', () => {
  test('should be healthy', async ({ request }) => {
    // Health endpoints require JWT token for encryption
    const testJWTToken = process.env.E2E_TEST_JWT_TOKEN;
    if (!testJWTToken) {
      throw new Error('E2E_TEST_JWT_TOKEN not set. Run setup-test-secrets.js first.');
    }
    
    const response = await request.get(`${WORKER_URLS.OTP_AUTH}/health`, {
      headers: {
        'Cookie': `auth_token=${testJWTToken}`,
      },
    });
    expect(response.ok()).toBeTruthy();
    
    // Health endpoint returns encrypted response - verify it's encrypted and response is OK
    // We don't need to decrypt for health checks, just verify the endpoint responds correctly
    expect(response.ok()).toBeTruthy();
    
    const responseData = await response.json();
    // Verify response is encrypted (health endpoints use JWT encryption)
    const isEncrypted = response.headers()['x-encrypted'] === 'true' || 
                       (responseData && typeof responseData === 'object' && 'encrypted' in responseData && responseData.encrypted === true);
    expect(isEncrypted).toBeTruthy();
  });
});

