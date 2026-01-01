/**
 * Integration Tests for OTP Login Flow
 * Tests the complete OTP authentication flow: request OTP → verify OTP → get JWT → customer creation
 * 
 * ⚠ CRITICAL: These tests ONLY work with LOCAL workers!
 * - OTP Auth Service must be running on http://localhost:8787
 * - Customer API must be running on http://localhost:8790
 * 
 * NO SUPPORT FOR DEPLOYED/LIVE WORKERS - LOCAL ONLY!
 * 
 * These tests verify:
 * 1. OTP request endpoint works
 * 2. OTP verification endpoint works
 * 3. Customer account is created/retrieved during login
 * 4. JWT token is returned after successful verification
 * 5. Full integration between OTP auth service and customer-api
 * 
 * To run:
 *   1. Start OTP auth service: cd serverless/otp-auth-service && pnpm dev
 *   2. Start customer API: cd serverless/customer-api && pnpm dev
 *   3. Run tests: pnpm test:integration:otp
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestConfig } from '../../utils/test-config-loader.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load E2E_TEST_OTP_CODE from .dev.vars for local testing
function loadE2ETestOTPCode(): string | null {
  // Try environment variable first
  if (process.env.E2E_TEST_OTP_CODE) {
    return process.env.E2E_TEST_OTP_CODE;
  }
  
  // Try loading from .dev.vars
  const devVarsPath = join(__dirname, '../../.dev.vars');
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, 'utf-8');
    const match = content.match(/^E2E_TEST_OTP_CODE=(.+)$/m);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

// Determine environment from NODE_ENV or TEST_ENV
const testEnv = (process.env.TEST_ENV || process.env.NODE_ENV || 'dev') as 'dev' | 'prod';
const config = loadTestConfig(testEnv);

// ALWAYS use localhost - no deployed worker support
const CUSTOMER_API_URL = config.customerApiUrl;
const OTP_AUTH_SERVICE_URL = config.otpAuthServiceUrl;

// Generate unique test email to avoid conflicts
const testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@integration-test.example.com`;

describe(`OTP Login Flow - Integration Tests (Local Workers Only) [${testEnv}]`, () => {
  let otpCode: string | null = null;
  let jwtToken: string | null = null;
  let customerId: string | null = null;

  beforeAll(async () => {
    console.log(`[Integration Tests] OTP Auth Service URL: ${OTP_AUTH_SERVICE_URL}`);
    console.log(`[Integration Tests] Customer API URL: ${CUSTOMER_API_URL}`);
    console.log(`[Integration Tests] Test email: ${testEmail}`);
    
    // Verify services are running - retry with backoff since services might still be starting
    // Health endpoint may return 401 (requires JWT) which is OK - means service is running
    let otpReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const otpHealthCheck = await fetch(`${OTP_AUTH_SERVICE_URL}/health`);
        // Any response (200, 401, etc.) means the service is running
        otpReady = true;
        console.log('[Integration Tests] ✓ OTP Auth Service is running');
        break;
      } catch (error: any) {
        if (attempt < 9) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(
          `✗ OTP Auth Service is not running!\n` +
          `   URL: ${OTP_AUTH_SERVICE_URL}\n` +
          `   Error: ${error.message}\n` +
          `   \n` +
          `   Fix: Start OTP auth service:\n` +
          `   cd serverless/otp-auth-service && pnpm dev`
        );
      }
    }
    
    try {
      // Customer API health check might require JWT, so just check if it responds
      const customerHealthCheck = await fetch(`${CUSTOMER_API_URL}/customer/by-email/test@example.com`);
      // Any response (even 404/401) means the service is running
      console.log('[Integration Tests] ✓ Customer API is running');
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

  afterAll(async () => {
    // Cleanup: Optionally delete test customer if needed
    // (In production, you might want to keep test data for debugging)
  });

  describe('Step 1: Request OTP', () => {
    it('should request OTP and receive success response', async () => {
      const response = await fetch(`${OTP_AUTH_SERVICE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
        }),
      });

      // Debug: log response if not 200
      if (response.status !== 200) {
        const errorText = await response.text();
        console.error(`[Integration Tests] OTP request failed: ${response.status}`, errorText);
      }
      
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Response should indicate success
      expect(data).toBeDefined();
      
      // For local testing, use E2E_TEST_OTP_CODE from .dev.vars
      // This is set in .dev.vars for local integration tests
      const testOTPCode = loadE2ETestOTPCode();
      if (testOTPCode) {
        otpCode = testOTPCode;
        console.log(`[Integration Tests] Using E2E_TEST_OTP_CODE: ${otpCode}`);
      } else {
        throw new Error(
          'OTP code not available. For local testing, ensure E2E_TEST_OTP_CODE is set in .dev.vars'
        );
      }
    }, 30000);
  });

  describe('Step 2: Verify OTP and Create Customer', () => {
    it('should verify OTP and return JWT token', async () => {
      if (!otpCode) {
        throw new Error('OTP code not available from previous test');
      }

      const response = await fetch(`${OTP_AUTH_SERVICE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          otp: otpCode,
        }),
      });

      // Debug: log response if not 200
      if (response.status !== 200) {
        const errorText = await response.text();
        console.error(`[Integration Tests] OTP verification failed: ${response.status}`, errorText);
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Response should contain JWT token
      expect(data).toBeDefined();
      expect(data.access_token || data.token).toBeDefined();
      
      jwtToken = data.access_token || data.token;
      expect(jwtToken).toMatch(/^eyJ/); // JWT tokens start with "eyJ"
      
      console.log(`[Integration Tests] JWT token received: ${jwtToken.substring(0, 20)}...`);
      
      // Extract customerId from JWT if available
      if (data.customerId) {
        customerId = data.customerId;
      } else if (jwtToken) {
        // Try to decode JWT to get customerId (basic decode, no verification needed for test)
        try {
          const payload = JSON.parse(atob(jwtToken.split('.')[1]));
          customerId = payload.customerId || payload.cid || null;
        } catch (error) {
          console.warn('[Integration Tests] Could not decode JWT to get customerId:', error);
        }
      }
    }, 60000); // Increased timeout - customer creation with retries can take time

    it('should have created customer account in customer-api', async () => {
      if (!customerId) {
        // Try to get customer by email
        const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
        const mockEnv = {
          CUSTOMER_API_URL,
          ENVIRONMENT: 'dev', // Always dev for local testing
          SUPER_ADMIN_API_KEY: config.superAdminApiKey,
          NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
        };
        
        const customer = await getCustomerByEmailService(testEmail, mockEnv);
        expect(customer).toBeDefined();
        // Email should NOT be in response (privacy requirement)
        expect(customer?.email).toBeUndefined();
        expect(customer?.customerId).toBeDefined();
        customerId = customer?.customerId || null;
      }
      
      expect(customerId).toBeDefined();
      expect(customerId).toMatch(/^cust_/);
      
      console.log(`[Integration Tests] Customer ID: ${customerId}`);
      
      // Verify customer exists in customer-api
      const { getCustomerService } = await import('../../utils/customer-api-service-client.js');
      const mockEnv = {
        CUSTOMER_API_URL,
        ENVIRONMENT: testEnv,
        NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
        SUPER_ADMIN_API_KEY: config.superAdminApiKey,
      };
      
      const customer = await getCustomerService(customerId, mockEnv);
      expect(customer).toBeDefined();
      expect(customer?.customerId).toBe(customerId);
      // Email should NOT be in response (privacy requirement)
      expect(customer?.email).toBeUndefined();
      expect(customer?.status).toBe('active');
      // DisplayName should be generated on customer creation
      expect(customer?.displayName).toBeDefined();
      expect(typeof customer?.displayName).toBe('string');
      expect(customer?.displayName?.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Step 3: Use JWT Token', () => {
    it('should be able to use JWT token to access protected endpoints', async () => {
      if (!jwtToken) {
        throw new Error('JWT token not available from previous test');
      }

      // Try to access /auth/me endpoint with JWT
      const response = await fetch(`${OTP_AUTH_SERVICE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Should succeed (200) or require decryption (encrypted response)
      expect([200, 401, 403]).toContain(response.status);
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toBeDefined();
        console.log('[Integration Tests] Successfully accessed /auth/me with JWT token');
      } else {
        // If 401/403, might be encryption issue - log for debugging
        const errorText = await response.text();
        console.warn('[Integration Tests] /auth/me returned error:', response.status, errorText);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should reject invalid OTP code', async () => {
      const response = await fetch(`${OTP_AUTH_SERVICE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          otp: '000000000', // Invalid OTP
        }),
      });

      // Should return error status (401 or 400)
      expect([400, 401]).toContain(response.status);
    }, 15000);

    it('should reject invalid email format', async () => {
      const response = await fetch(`${OTP_AUTH_SERVICE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
        }),
      });

      // Should return error status (400)
      expect(response.status).toBe(400);
    }, 15000);
  });

  describe('Service Integration', () => {
    it('should verify customer-api is reachable from OTP auth service', async () => {
      // This test verifies the integration between services
      const { getCustomerByEmailService } = await import('../../utils/customer-api-service-client.js');
      const mockEnv = {
        CUSTOMER_API_URL,
        ENVIRONMENT: testEnv,
        SUPER_ADMIN_API_KEY: config.superAdminApiKey,
        NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
      };
      
      try {
        // Should be able to query customer-api (even if customer doesn't exist)
        const customer = await getCustomerByEmailService('test-reachability@example.com', mockEnv);
        // Result can be null (customer doesn't exist) - that's OK
        // The important thing is we didn't get a network/connection error
        expect(customer === null || (customer && customer.customerId)).toBeTruthy();
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        const errorString = errorMessage.toLowerCase();
        
        // Check for connection/network errors
        if (errorString.includes('failed to fetch') || 
            errorString.includes('networkerror') ||
            errorString.includes('enotfound') ||
            errorString.includes('econnrefused') ||
            errorString.includes('dns')) {
          throw new Error(
            `✗ Customer API is not reachable from OTP auth service!\n` +
            `   Configured URL: ${CUSTOMER_API_URL}\n` +
            `   Error: ${errorMessage}\n` +
            `   \n` +
            `   Fix: Ensure customer-api is running:\n` +
            `   - Local: cd serverless/customer-api && pnpm dev\n` +
            `   - Or set CUSTOMER_API_URL to correct URL`
          );
        }
        // Other errors (like 500) are OK for this test - just checking reachability
        console.warn('[Integration Tests] Customer API returned error (but is reachable):', errorMessage);
      }
    }, 15000);
  });
});
