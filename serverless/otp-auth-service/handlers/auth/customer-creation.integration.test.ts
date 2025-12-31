/**
 * Integration Tests for Customer Account Creation
 * Tests ensureCustomerAccount function against LIVE customer-api
 * 
 * ⚠ IMPORTANT: These tests use the REAL customer-api service
 * 
 * These tests only run when:
 * - USE_LIVE_API=true environment variable is set
 * - SERVICE_API_KEY is provided
 * - CUSTOMER_API_URL points to a deployed customer-api worker
 * 
 * In GitHub Actions CI:
 * - Automatically runs on push/PR to main/develop
 * - Uses secrets: CUSTOMER_API_URL, SERVICE_API_KEY
 * - Verifies actual integration between services
 * - Will FAIL if CUSTOMER_API_URL is wrong (catches configuration bugs!)
 * 
 * To run locally:
 *   USE_LIVE_API=true CUSTOMER_API_URL=https://... SERVICE_API_KEY=... pnpm test customer-creation.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ensureCustomerAccount } from './customer-creation.js';
import { loadTestConfig } from '../../utils/test-config-loader.js';

// Determine environment from NODE_ENV or TEST_ENV
const testEnv = (process.env.TEST_ENV || process.env.NODE_ENV || 'dev') as 'dev' | 'prod';
const config = loadTestConfig(testEnv);

// Only run integration tests when USE_LIVE_API is set
const USE_LIVE_API = config.useLiveApi;
const CUSTOMER_API_URL = config.customerApiUrl;
const SERVICE_API_KEY = config.serviceApiKey;
// NETWORK_INTEGRITY_KEYPHRASE must match the value in customer-api worker for integration tests
const NETWORK_INTEGRITY_KEYPHRASE = process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests';

describe.skipIf(!USE_LIVE_API)(`ensureCustomerAccount - Integration Tests (Live API) [${testEnv}]`, () => {
  const mockEnv = {
    OTP_AUTH_KV: {} as any, // Not used in these tests
    CUSTOMER_API_URL,
    SERVICE_API_KEY,
    NETWORK_INTEGRITY_KEYPHRASE,
  };

  // Generate unique test email to avoid conflicts
  const testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@integration-test.example.com`;

  beforeAll(() => {
    if (!SERVICE_API_KEY) {
      throw new Error('SERVICE_API_KEY environment variable is required for integration tests');
    }
    if (!CUSTOMER_API_URL) {
      throw new Error('CUSTOMER_API_URL environment variable is required for integration tests');
    }
    console.log(`[Integration Tests] Using live API: ${CUSTOMER_API_URL}`);
  });

  describe('Legacy user migration with live customer-api', () => {
    it('should create customer account via live customer-api', async () => {
      // Execute: Create customer account for legacy user
      const customerId = await ensureCustomerAccount(testEmail, null, mockEnv);

      // Verify: Customer account was created
      expect(customerId).toBeDefined();
      expect(customerId).toMatch(/^cust_/);
      expect(typeof customerId).toBe('string');
      expect(customerId.length).toBeGreaterThan(10);

      // Verify: Can retrieve customer by email
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      const customer = await getCustomerByEmailService(testEmail, mockEnv);
      
      expect(customer).toBeDefined();
      expect(customer?.customerId).toBe(customerId);
      expect(customer?.email).toBe(testEmail.toLowerCase().trim());
      expect(customer?.status).toBe('active');
    }, 30000); // 30 second timeout for live API calls

    it('should handle UPSERT - update existing customer account', async () => {
      // Setup: Create customer first
      const firstCustomerId = await ensureCustomerAccount(testEmail, null, mockEnv);
      expect(firstCustomerId).toBeDefined();

      // Execute: Call ensureCustomerAccount again (should return existing)
      const secondCustomerId = await ensureCustomerAccount(testEmail, null, mockEnv);

      // Verify: Same customer ID returned (not created again)
      expect(secondCustomerId).toBe(firstCustomerId);

      // Verify: Customer still exists and is active
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      const customer = await getCustomerByEmailService(testEmail, mockEnv);
      
      expect(customer).toBeDefined();
      expect(customer?.customerId).toBe(firstCustomerId);
      expect(customer?.status).toBe('active');
    }, 30000);

    it('should verify customer-api URL is correct and reachable', async () => {
      // This test verifies the URL configuration is correct
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      
      // Try to call the API - should not throw network/404 errors
      try {
        // This should return null (customer doesn't exist yet), not throw an error
        const result = await getCustomerByEmailService('nonexistent@test.example.com', mockEnv);
        expect(result).toBeNull(); // Customer doesn't exist, but API is reachable
      } catch (error: any) {
        // Check for URL/network errors
        const errorMessage = error.message || String(error);
        const errorString = errorMessage.toLowerCase();
        
        if (errorString.includes('failed to fetch') || 
            errorString.includes('networkerror') ||
            errorString.includes('enotfound') ||
            errorString.includes('econnrefused') ||
            errorString.includes('dns') ||
            (errorString.includes('404') && errorString.includes('not found'))) {
          throw new Error(
            `✗ Customer API URL is incorrect or unreachable!\n` +
            `   Configured URL: ${CUSTOMER_API_URL}\n` +
            `   Error: ${errorMessage}\n` +
            `   \n` +
            `   Fix: Set CUSTOMER_API_URL to the correct customer-api worker URL:\n` +
            `   - Workers.dev: https://strixun-customer-api.strixuns-script-suite.workers.dev\n` +
            `   - Custom domain: https://customer.idling.app (if configured)`
          );
        }
        // Other errors (like auth) are expected and OK - re-throw to see what it is
        throw error;
      }
    }, 15000);

    it('should verify SERVICE_API_KEY authentication works', async () => {
      // This test verifies service-to-service authentication
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      
      try {
        // Should not throw authentication errors
        await getCustomerByEmailService('test-auth@example.com', mockEnv);
        // If we get here, auth worked (even if customer doesn't exist)
      } catch (error: any) {
        // Check if it's an auth error
        if (error.message?.includes('401') || 
            error.message?.includes('Unauthorized') ||
            error.message?.includes('Authentication required')) {
          throw new Error(`SERVICE_API_KEY authentication failed. Check that SERVICE_API_KEY is set correctly in both workers. Error: ${error.message}`);
        }
        // Other errors are OK (like customer not found)
        if (!error.message?.includes('Failed to get customer by email')) {
          throw error;
        }
      }
    }, 15000);
  });

  describe('Error handling with live API', () => {
    it('should throw error if customer-api is unreachable', async () => {
      // Use invalid URL to test error handling
      const invalidEnv = {
        ...mockEnv,
        CUSTOMER_API_URL: 'https://invalid-url-that-does-not-exist-12345.example.com',
      };

      await expect(
        ensureCustomerAccount('test@example.com', null, invalidEnv)
      ).rejects.toThrow();
    }, 15000);
  });
});

