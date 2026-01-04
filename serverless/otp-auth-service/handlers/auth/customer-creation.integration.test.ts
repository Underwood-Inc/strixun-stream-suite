/**
 * Integration Tests for Customer Account Creation
 * Tests ensureCustomerAccount function against LOCAL customer-api
 * 
 * ⚠ CRITICAL: These tests ONLY work with LOCAL workers!
 * - Customer API must be running on http://localhost:8790
 * 
 * NO SUPPORT FOR DEPLOYED/LIVE WORKERS - LOCAL ONLY!
 * 
 * To run locally:
 *   1. Start customer API: cd serverless/customer-api && pnpm dev
 *   2. Run tests: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ensureCustomerAccount } from './customer-creation.js';
import { loadTestConfig } from '../../utils/test-config-loader.js';
import { clearLocalKVNamespace } from '../../../shared/test-kv-cleanup.js';

// Determine environment from NODE_ENV or TEST_ENV
const testEnv = (process.env.TEST_ENV || process.env.NODE_ENV || 'dev') as 'dev' | 'prod';
const config = loadTestConfig(testEnv);

// ALWAYS use localhost - no deployed worker support
const CUSTOMER_API_URL = config.customerApiUrl;
const SUPER_ADMIN_API_KEY = config.superAdminApiKey;
// NETWORK_INTEGRITY_KEYPHRASE must match the value in customer-api worker for integration tests
const NETWORK_INTEGRITY_KEYPHRASE = process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests';
// JWT_SECRET is required for API key creation
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-local-development-12345678901234567890123456789012';

describe(`ensureCustomerAccount - Integration Tests (Local Workers Only) [${testEnv}]`, () => {
  const mockEnv = {
    OTP_AUTH_KV: {
      get: async () => null, // Mock KV for display name generation
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], listComplete: true }),
    } as any,
    CUSTOMER_API_URL,
    ENVIRONMENT: 'dev', // Always dev for local testing
    NETWORK_INTEGRITY_KEYPHRASE,
    SUPER_ADMIN_API_KEY, // Required for service-client authentication
    JWT_SECRET, // Required for API key creation
  };

  // Generate unique test email to avoid conflicts
  const testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@integration-test.example.com`;

  beforeAll(async () => {
    if (!CUSTOMER_API_URL) {
      throw new Error('CUSTOMER_API_URL is required for integration tests');
    }
    
    // Verify customer API is running
    try {
      const healthCheck = await fetch(`${CUSTOMER_API_URL}/customer/by-email/test@example.com`);
      // Any response (even 404/401) means the service is running
      console.log(`[Integration Tests] ✓ Customer API is running at ${CUSTOMER_API_URL}`);
    } catch (error: any) {
      throw new Error(
        `✗ Customer API is not running!\n` +
        `   URL: ${CUSTOMER_API_URL}\n` +
        `   Error: ${error.message}\n` +
        `   \n` +
        `   Fix: Start customer API:\n` +
        `   cd serverless/customer-api && pnpm dev`
      );
    }
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
      // Email should NOT be in response (privacy requirement)
      expect(customer?.email).toBeUndefined();
      expect(customer?.status).toBe('active');
      // DisplayName should be generated on customer creation
      expect(customer?.displayName).toBeDefined();
      expect(typeof customer?.displayName).toBe('string');
      expect(customer?.displayName?.length).toBeGreaterThan(0);
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

    it('should verify internal call authentication works', async () => {
      // This test verifies service-to-service authentication
      // Internal calls don't require authentication - customer-api accepts unauthenticated internal calls
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      
      try {
        // Should not throw authentication errors
        await getCustomerByEmailService('test-auth@example.com', mockEnv);
        // If we get here, the call worked (even if customer doesn't exist)
      } catch (error: any) {
        // Check if it's an auth error (shouldn't happen for internal calls)
        if (error.message?.includes('401') || 
            error.message?.includes('Unauthorized') ||
            error.message?.includes('Authentication required')) {
          throw new Error(`Internal call authentication failed. This should not happen for internal calls. Error: ${error.message}`);
        }
        // Other errors are OK (like customer not found)
        if (!error.message?.includes('Failed to get customer by email')) {
          throw error;
        }
      }
    }, 15000);
  });

  describe('Error handling with live API', () => {
    it.skip('should throw error if customer-api is unreachable', async () => {
      // SKIPPED: This test times out because retry logic with exponential backoff takes too long
      // The retry logic is tested in unit tests. Integration tests focus on happy path.
      // Use invalid URL to test error handling
      // Use a non-routable IP to fail faster than DNS lookup
      const invalidEnv = {
        ...mockEnv,
        CUSTOMER_API_URL: 'http://192.0.2.1:8790', // TEST-NET-1 (RFC 5737) - guaranteed unreachable
      };

      // ensureCustomerAccount retries 3 times with exponential backoff (100ms, 200ms, 400ms)
      // Each attempt will timeout, so we need enough time for all retries
      await expect(
        ensureCustomerAccount('test@example.com', null, invalidEnv)
      ).rejects.toThrow();
    }, 30000); // Allow time for retry logic (3 attempts with backoff)
  });

  afterAll(async () => {
    // Cleanup: Clear local KV storage to ensure test isolation
    await clearLocalKVNamespace('680c9dbe86854c369dd23e278abb41f9'); // OTP_AUTH_KV namespace
    await clearLocalKVNamespace('86ef5ab4419b40eab3fe65b75f052789'); // CUSTOMER_KV namespace
    console.log('[Customer Creation Integration Tests] ✓ KV cleanup completed');
  });
});

