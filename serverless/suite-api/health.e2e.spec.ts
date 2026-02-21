/**
 * Suite API Health Check E2E Tests
 *
 * Verifies the Suite API worker is accessible and responding correctly.
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '@strixun/e2e-helpers';

test.describe('Suite API Health', () => {
  test('should be healthy', async ({ request }) => {
    const testJWTToken = process.env.E2E_TEST_JWT_TOKEN;
    if (!testJWTToken) {
      throw new Error('E2E_TEST_JWT_TOKEN not set. Run setup-test-secrets.js first.');
    }
    const response = await request.get(`${WORKER_URLS.SUITE_API}/health`, {
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

