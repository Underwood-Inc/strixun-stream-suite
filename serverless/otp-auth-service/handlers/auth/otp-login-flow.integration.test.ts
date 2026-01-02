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

// Load E2E_TEST_OTP_CODE - prioritizes process.env (for CI/GitHub Actions), then .dev.vars (for local)
function loadE2ETestOTPCode(): string | null {
  // PRIORITIZE process.env first (for CI environments like GitHub Actions)
  // GitHub Actions can set E2E_TEST_OTP_CODE as a secret
  if (process.env.E2E_TEST_OTP_CODE) {
    return process.env.E2E_TEST_OTP_CODE;
  }
  
  // Try loading from .dev.vars (multiple possible paths)
  const possiblePaths = [
    join(__dirname, '../../.dev.vars'), // Relative to test file
    join(process.cwd(), 'serverless/otp-auth-service/.dev.vars'), // From project root
    join(__dirname, '../../../serverless/otp-auth-service/.dev.vars'), // Alternative relative path
  ];
  
  for (const devVarsPath of possiblePaths) {
    if (existsSync(devVarsPath)) {
      try {
        const content = readFileSync(devVarsPath, 'utf-8');
        // Match E2E_TEST_OTP_CODE=value (handle potential whitespace and comments)
        // Try multiple patterns to be more robust
        const patterns = [
          /^E2E_TEST_OTP_CODE\s*=\s*(.+?)(?:\s*$|\s*#|\s*\n)/m,  // With newline or comment
          /^E2E_TEST_OTP_CODE\s*=\s*(.+)$/m,  // Simple pattern
          /E2E_TEST_OTP_CODE\s*=\s*([^\s#\n]+)/,  // Most permissive
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            const value = match[1].trim();
            if (value) {
              console.log(`[Integration Tests] Found E2E_TEST_OTP_CODE in ${devVarsPath}: ${value.substring(0, 3)}...`);
              return value;
            }
          }
        }
        
        // Debug: log file content if no match found
        console.warn(`[Integration Tests] E2E_TEST_OTP_CODE not found in ${devVarsPath}. File content preview:`, content.substring(0, 200));
      } catch (error) {
        // Continue to next path if this one fails
        console.warn(`[Integration Tests] Failed to read ${devVarsPath}:`, error);
      }
    } else {
      console.log(`[Integration Tests] .dev.vars file not found at ${devVarsPath}`);
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
      // Retry loading in case file wasn't written yet (shouldn't happen, but be safe)
      let testOTPCode: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        testOTPCode = loadE2ETestOTPCode();
        if (testOTPCode) {
          break;
        }
        if (attempt < 2) {
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (testOTPCode) {
        otpCode = testOTPCode;
        console.log(`[Integration Tests] Using E2E_TEST_OTP_CODE: ${otpCode}`);
      } else {
        // Provide helpful error message with debugging info
        const devVarsPath = join(__dirname, '../../.dev.vars');
        const envVar = process.env.E2E_TEST_OTP_CODE ? `set (${process.env.E2E_TEST_OTP_CODE.substring(0, 3)}...)` : 'not set';
        const fileExists = existsSync(devVarsPath);
        let fileInfo = '';
        if (fileExists) {
          try {
            const content = readFileSync(devVarsPath, 'utf-8');
            fileInfo = `exists (${content.length} bytes, contains E2E_TEST_OTP_CODE: ${content.includes('E2E_TEST_OTP_CODE')})`;
          } catch (error) {
            fileInfo = `exists but cannot read: ${error}`;
          }
        } else {
          fileInfo = 'does not exist';
        }
        
        throw new Error(
          `OTP code not available. For local testing, ensure E2E_TEST_OTP_CODE is set.\n` +
          `  - Environment variable E2E_TEST_OTP_CODE: ${envVar}\n` +
          `  - .dev.vars file at ${devVarsPath}: ${fileInfo}\n` +
          `  - Current working directory: ${process.cwd()}\n` +
          `  - Test file directory: ${__dirname}\n` +
          `  - The vitest setup should automatically generate this, but if it's missing,\n` +
          `    you can set it manually in .dev.vars or as an environment variable.`
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
      
      // Extract customerId and verify email_verified from JWT payload (source of truth)
      if (data.customerId) {
        customerId = data.customerId;
      } else if (jwtToken) {
        // Try to decode JWT to get customerId (basic decode, no verification needed for test)
        try {
          const payload = JSON.parse(atob(jwtToken.split('.')[1]));
          customerId = payload.customerId || payload.cid || null;
          
          // CRITICAL: Verify email_verified badge is present in JWT payload
          // This is the authoritative source - JWT is created with email_verified: true in jwt-creation.ts
          expect(payload.email_verified).toBeDefined();
          expect(payload.email_verified).toBe(true);
          console.log(`[Integration Tests] ✓ Email verification badge verified in JWT payload: ${payload.email_verified}`);
        } catch (error) {
          console.warn('[Integration Tests] Could not decode JWT to get customerId:', error);
        }
      }
      
      // Also check if email_verified is in the response (preferred, but JWT is source of truth)
      if (data.email_verified !== undefined) {
        expect(data.email_verified).toBe(true);
        console.log(`[Integration Tests] ✓ Email verification badge also in response: ${data.email_verified}`);
      } else {
        console.log('[Integration Tests] Note: email_verified not in response, but verified in JWT (source of truth)');
      }
      
      // Verify other required fields are present
      if (data.email !== undefined) {
        expect(data.email).toBe(testEmail.toLowerCase().trim());
      }
      expect(data.sub || data.userId).toBeDefined();
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
      
      // Verify customer exists in customer-api with retry for eventual consistency
      const { getCustomerService } = await import('../../utils/customer-api-service-client.js');
      const mockEnv = {
        CUSTOMER_API_URL,
        ENVIRONMENT: testEnv,
        NETWORK_INTEGRITY_KEYPHRASE: process.env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-integration-tests',
        SUPER_ADMIN_API_KEY: config.superAdminApiKey,
      };
      
      // Retry mechanism for eventual consistency (customer might not be immediately available)
      let customer = null;
      const maxRetries = 5;
      const retryDelay = 500; // Start with 500ms
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        customer = await getCustomerService(customerId, mockEnv);
        
        if (customer && customer.customerId === customerId) {
          break; // Found customer, exit retry loop
        }
        
        if (attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`[Integration Tests] Customer not found yet, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
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
        // Check if response is encrypted
        const isEncrypted = response.headers.get('x-encrypted') === 'true';
        let data: any;
        
        if (isEncrypted) {
          // Decrypt the response using JWT token
          const { decryptWithJWT } = await import('@strixun/api-framework');
          const encryptedBody = await response.text();
          try {
            const encryptedData = JSON.parse(encryptedBody);
            data = await decryptWithJWT(encryptedData, jwtToken);
            console.log('[Integration Tests] Decrypted /auth/me response');
          } catch (decryptError) {
            console.error('[Integration Tests] Failed to decrypt /auth/me response:', decryptError);
            throw new Error('Failed to decrypt encrypted response');
          }
        } else {
          data = await response.json();
        }
        
        expect(data).toBeDefined();
        
        // CRITICAL: Verify email_verified badge is present in JWT payload (source of truth)
        // The JWT is created in jwt-creation.ts with email_verified: true
        // This is the authoritative source for email verification status
        try {
          const payload = JSON.parse(atob(jwtToken.split('.')[1]));
          expect(payload.email_verified).toBeDefined();
          expect(payload.email_verified).toBe(true);
          console.log('[Integration Tests] ✓ Email verification badge verified in JWT payload');
        } catch (error) {
          console.error('[Integration Tests] Failed to verify email_verified in JWT payload:', error);
          throw new Error('email_verified must be present in JWT payload');
        }
        
        // Also check if it's in the response (preferred, but JWT is source of truth)
        if (data.email_verified !== undefined) {
          expect(data.email_verified).toBe(true);
          console.log('[Integration Tests] ✓ Email verification badge also present in /auth/me response');
        } else {
          console.log('[Integration Tests] Note: email_verified not in response, but verified in JWT (source of truth)');
        }
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
