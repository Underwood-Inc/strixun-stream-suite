/**
 * Unit Tests for Customer Account Creation
 * Tests ensureCustomerAccount function for legacy user migration
 * 
 * ⚠️ NOTE: These are MOCKED unit tests - they will NOT catch:
 * - Incorrect CUSTOMER_API_URL configuration
 * - Network/connectivity issues
 * - Authentication problems (SERVICE_API_KEY)
 * 
 * For integration tests against live API, see: customer-creation.integration.test.ts
 * Integration tests run automatically in GitHub Actions CI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureCustomerAccount } from './customer-creation.js';
import * as customerApiClient from '../../utils/customer-api-service-client.js';
import * as customerService from '../../services/customer.js';
import * as apiKeyService from '../../services/api-key.js';
import * as nameGenerator from '../../services/nameGenerator.js';

// Mock dependencies
vi.mock('../../utils/customer-api-service-client.js');
vi.mock('../../services/customer.js');
vi.mock('../../services/api-key.js');
vi.mock('../../services/nameGenerator.js');

describe('ensureCustomerAccount - Legacy User Migration', () => {
  const mockEnv = {
    OTP_AUTH_KV: {} as any,
    CUSTOMER_API_URL: 'https://customer.idling.app',
    SERVICE_API_KEY: 'test-service-key',
    NETWORK_INTEGRITY_KEYPHRASE: 'test-integrity-keyphrase-for-tests',
  };

  const legacyUserEmail = 'legacy.user@example.com';
  const legacyUserId = 'user_legacy123';
  const newCustomerId = 'cust_new456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Legacy user with no customer account', () => {
    it('should create a new customer account for legacy user on first login', async () => {
      // Setup: Legacy user exists but has no customer account
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('LegacyUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({
        customerId: newCustomerId,
        email: legacyUserEmail,
        status: 'active',
      } as any);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValueOnce(null).mockResolvedValueOnce({
        customerId: newCustomerId,
        email: legacyUserEmail,
        status: 'active',
      } as any);
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute: Legacy user logs in
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Customer account was created and linked
      expect(result).toBe(newCustomerId);
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledWith(legacyUserEmail.toLowerCase().trim(), mockEnv);
      expect(customerService.generateCustomerId).toHaveBeenCalled();
      expect(customerApiClient.createCustomerService).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: newCustomerId,
          email: legacyUserEmail.toLowerCase().trim(),
          status: 'active',
          plan: 'free',
          tier: 'free',
        }),
        mockEnv
      );
      expect(apiKeyService.createApiKeyForCustomer).toHaveBeenCalledWith(newCustomerId, 'Initial API Key', mockEnv);
    });

    it('should link customer account to legacy user email', async () => {
      // Setup: Legacy user with no customer account
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('LegacyUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({
        customerId: newCustomerId,
        email: legacyUserEmail,
      } as any);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValueOnce(null).mockResolvedValueOnce({
        customerId: newCustomerId,
        email: legacyUserEmail.toLowerCase().trim(),
      } as any);
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Customer account is linked to the email
      expect(result).toBe(newCustomerId);
      const createCall = vi.mocked(customerApiClient.createCustomerService).mock.calls[0];
      expect(createCall[0]).toMatchObject({
        email: legacyUserEmail.toLowerCase().trim(),
        customerId: newCustomerId,
      });
    });

    it('should include all required fields in created customer account', async () => {
      // Setup
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('LegacyUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({} as any);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValueOnce(null).mockResolvedValueOnce({
        customerId: newCustomerId,
      } as any);
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute
      await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: All required fields are present
      const createCall = vi.mocked(customerApiClient.createCustomerService).mock.calls[0][0];
      expect(createCall).toMatchObject({
        customerId: newCustomerId,
        email: legacyUserEmail.toLowerCase().trim(),
        status: 'active',
        plan: 'free',
        tier: 'free',
        displayName: 'LegacyUser123',
        subscriptions: expect.arrayContaining([
          expect.objectContaining({
            planId: 'free',
            status: 'active',
          }),
        ]),
        config: expect.objectContaining({
          emailConfig: expect.any(Object),
          rateLimits: expect.any(Object),
          webhookConfig: expect.any(Object),
          allowedOrigins: expect.any(Array),
        }),
        features: expect.any(Object),
      });
    });
  });

  describe('Legacy user with existing customer account', () => {
    it('should find and return existing customer account by email', async () => {
      // Setup: Legacy user has existing customer account
      const existingCustomer = {
        customerId: 'cust_existing789',
        email: legacyUserEmail.toLowerCase().trim(),
        status: 'active',
      };

      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(existingCustomer as any);

      // Execute
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Existing customer account is returned
      expect(result).toBe('cust_existing789');
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledWith(legacyUserEmail.toLowerCase().trim(), mockEnv);
      expect(customerApiClient.createCustomerService).not.toHaveBeenCalled();
    });

    it('should reactivate suspended customer account for legacy user', async () => {
      // Setup: Legacy user has suspended customer account
      const suspendedCustomer = {
        customerId: 'cust_suspended123',
        email: legacyUserEmail.toLowerCase().trim(),
        status: 'suspended',
      };

      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(suspendedCustomer as any);
      vi.mocked(customerApiClient.updateCustomerService).mockResolvedValue({
        ...suspendedCustomer,
        status: 'active',
      } as any);

      // Execute
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Customer account is reactivated
      expect(result).toBe('cust_suspended123');
      expect(customerApiClient.updateCustomerService).toHaveBeenCalledWith(
        'cust_suspended123',
        expect.objectContaining({
          status: 'active',
        }),
        mockEnv
      );
    });

    it('should update customer account if missing required fields (UPSERT)', async () => {
      // Setup: Legacy user has customer account but missing fields
      const incompleteCustomer = {
        customerId: 'cust_incomplete456',
        email: legacyUserEmail.toLowerCase().trim(),
        status: 'active',
        // Missing: displayName, subscriptions, config
      };

      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(incompleteCustomer as any);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('UpdatedUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.updateCustomerService).mockResolvedValue({
        ...incompleteCustomer,
        displayName: 'UpdatedUser123',
        subscriptions: expect.any(Array),
        config: expect.any(Object),
      } as any);

      // Execute
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Customer account is updated with missing fields
      expect(result).toBe('cust_incomplete456');
      expect(customerApiClient.updateCustomerService).toHaveBeenCalledWith(
        'cust_incomplete456',
        expect.objectContaining({
          displayName: 'UpdatedUser123',
          subscriptions: expect.arrayContaining([
            expect.objectContaining({
              planId: 'free',
            }),
          ]),
          config: expect.any(Object),
        }),
        mockEnv
      );
    });
  });

  describe('Legacy user with customerId in JWT but customer missing', () => {
    it('should recover customer account by email when customerId in JWT is invalid', async () => {
      // Setup: JWT has customerId but customer doesn't exist, but email lookup finds it
      const recoveredCustomer = {
        customerId: 'cust_recovered999',
        email: legacyUserEmail.toLowerCase().trim(),
        status: 'active',
      };

      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(recoveredCustomer as any);

      // Execute: Legacy user logs in with invalid customerId in JWT
      const result = await ensureCustomerAccount(legacyUserEmail, 'cust_invalid123', mockEnv);

      // Verify: Customer account is recovered by email
      expect(result).toBe('cust_recovered999');
      expect(customerApiClient.getCustomerService).toHaveBeenCalledWith('cust_invalid123', mockEnv);
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledWith(legacyUserEmail.toLowerCase().trim(), mockEnv);
    });
  });

  describe('Retry logic and error handling', () => {
    it('should retry on transient failures when creating customer account', async () => {
      // Setup: First attempt fails, second succeeds
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService)
        .mockResolvedValueOnce(null) // First lookup - not found
        .mockResolvedValueOnce(null) // After create - not found yet (eventual consistency)
        .mockResolvedValueOnce({ customerId: newCustomerId } as any); // After retry - found
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('RetryUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({} as any);
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute
      const result = await ensureCustomerAccount(legacyUserEmail, null, mockEnv);

      // Verify: Retry logic was used
      expect(result).toBe(newCustomerId);
      // Should have called getCustomerByEmailService multiple times due to retry
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledTimes(3);
    });

    it('should throw error if customer account cannot be created after retries', async () => {
      // Setup: All attempts fail
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('FailUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockRejectedValue(new Error('Service unavailable'));

      // Execute & Verify: Should throw error
      await expect(ensureCustomerAccount(legacyUserEmail, null, mockEnv)).rejects.toThrow(
        'Failed to ensure customer account exists'
      );
    });
  });

  describe('Email normalization', () => {
    it('should normalize email to lowercase and trim whitespace', async () => {
      // Setup
      const emailWithSpaces = '  Legacy.User@Example.COM  ';
      const normalizedEmail = 'legacy.user@example.com';

      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('NormalizedUser123');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({} as any);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValueOnce(null).mockResolvedValueOnce({
        customerId: newCustomerId,
      } as any);
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute
      await ensureCustomerAccount(emailWithSpaces, null, mockEnv);

      // Verify: Email is normalized
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledWith(normalizedEmail, mockEnv);
      expect(customerApiClient.createCustomerService).toHaveBeenCalledWith(
        expect.objectContaining({
          email: normalizedEmail,
        }),
        mockEnv
      );
    });
  });

  describe('Integration scenario: Legacy user login flow', () => {
    it('should handle complete legacy user login scenario', async () => {
      // Scenario: Legacy user created before customer account migration
      // - User has user account in OTP_AUTH_KV
      // - User has NO customer account
      // - User logs in after migration
      // - System should create customer account and link it

      const legacyEmail = 'legacy.user@example.com';
      const newCustomerId = 'cust_migrated789';

      // Step 1: User account exists (simulated by no customer account found)
      vi.mocked(customerApiClient.getCustomerService).mockResolvedValue(null);
      vi.mocked(customerApiClient.getCustomerByEmailService).mockResolvedValue(null);

      // Step 2: System generates new customer account
      vi.mocked(customerService.generateCustomerId).mockReturnValue(newCustomerId);
      vi.mocked(nameGenerator.generateUniqueDisplayName).mockResolvedValue('MigratedUser456');
      vi.mocked(nameGenerator.reserveDisplayName).mockResolvedValue(undefined);

      // Step 3: System creates customer account
      vi.mocked(customerApiClient.createCustomerService).mockResolvedValue({
        customerId: newCustomerId,
        email: legacyEmail.toLowerCase().trim(),
        status: 'active',
      } as any);

      // Step 4: System verifies customer account was created (eventual consistency)
      vi.mocked(customerApiClient.getCustomerByEmailService)
        .mockResolvedValueOnce(null) // First check - not found yet
        .mockResolvedValueOnce({
          customerId: newCustomerId,
          email: legacyEmail.toLowerCase().trim(),
          status: 'active',
        } as any); // After retry - found

      // Step 5: System creates API key
      vi.mocked(apiKeyService.createApiKeyForCustomer).mockResolvedValue(undefined);

      // Execute: Legacy user logs in
      const result = await ensureCustomerAccount(legacyEmail, null, mockEnv);

      // Verify: Complete flow executed correctly
      expect(result).toBe(newCustomerId);
      expect(customerApiClient.getCustomerByEmailService).toHaveBeenCalledWith(legacyEmail.toLowerCase().trim(), mockEnv);
      expect(customerService.generateCustomerId).toHaveBeenCalled();
      expect(customerApiClient.createCustomerService).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: newCustomerId,
          email: legacyEmail.toLowerCase().trim(),
          status: 'active',
        }),
        mockEnv
      );
      expect(apiKeyService.createApiKeyForCustomer).toHaveBeenCalledWith(newCustomerId, 'Initial API Key', mockEnv);

      // Verify: Customer account is properly linked to email
      const createdCustomer = vi.mocked(customerApiClient.createCustomerService).mock.calls[0][0];
      expect(createdCustomer.email).toBe(legacyEmail.toLowerCase().trim());
      expect(createdCustomer.customerId).toBe(newCustomerId);
    });
  });
});

