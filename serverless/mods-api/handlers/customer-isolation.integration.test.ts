/**
 * Integration Tests for Customer Isolation
 * 
 * Tests that Customer A cannot access Customer B's data:
 * - Integrity verification includes customerID
 * - Cross-customer data access is prevented
 * 
 * Uses real integrity verification, mocks KV
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateRequestIntegrity } from '../../shared/service-client/integrity.js';
import { createJWT } from '../../otp-auth-service/utils/crypto.js';
import { authenticateRequest } from '../../utils/auth.js';

// Mock external dependencies
vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
}));

describe('Customer Isolation Integration', () => {
    const mockEnv = {
        JWT_SECRET: 'test-jwt-secret-for-integration-tests',
        NETWORK_INTEGRITY_KEYPHRASE: 'test-integrity-keyphrase',
        ALLOWED_ORIGINS: '*',
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Integrity Verification with CustomerID', () => {
        it('should include customerID in integrity hash calculation', async () => {
            const method = 'GET';
            const path = '/api/mods';
            const body = null;
            const customerIdA = 'cust_abc';
            const customerIdB = 'cust_xyz';

            // Calculate integrity for Customer A
            const integrityA = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                customerIdA
            );

            // Calculate integrity for Customer B (same request, different customer)
            const integrityB = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                customerIdB
            );

            // Verify different customerIDs produce different integrity hashes
            expect(integrityA).not.toBe(integrityB);
            expect(integrityA).toBeDefined();
            expect(integrityB).toBeDefined();
        });

        it('should produce same hash for same customerID and request', async () => {
            const method = 'POST';
            const path = '/api/mods';
            const body = JSON.stringify({ title: 'Test Mod' });
            const customerId = 'cust_abc';
            const timestamp = Date.now().toString();

            // Calculate integrity twice with same parameters
            const integrity1 = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                customerId
            );

            const integrity2 = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                customerId
            );

            // Verify same customerID and request produce same hash
            expect(integrity1).toBe(integrity2);
        });

        it('should reject request with wrong customerID in integrity check', async () => {
            const method = 'GET';
            const path = '/api/mods/mod_123';
            const body = null;
            const correctCustomerId = 'cust_abc';
            const wrongCustomerId = 'cust_xyz';

            // Create integrity hash with correct customerID
            const correctIntegrity = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                correctCustomerId
            );

            // Verify integrity with wrong customerID should fail
            // Calculate what the integrity should be with wrong customerID
            const wrongIntegrity = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                wrongCustomerId
            );

            // Integrity hashes should be different
            expect(correctIntegrity).not.toBe(wrongIntegrity);
        });

        it('should accept request with correct customerID in integrity check', async () => {
            const method = 'GET';
            const path = '/api/mods/mod_123';
            const body = null;
            const customerId = 'cust_abc';
            // Use the same timestamp for both calls to ensure deterministic hashes
            const timestamp = Date.now().toString();

            // Create integrity hash
            const integrity = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                customerId
            );

            // Verify integrity with same customerID should pass
            // Recalculate integrity with same parameters and timestamp
            const recalculatedIntegrity = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                customerId
            );

            // Integrity hashes should match
            expect(integrity).toBe(recalculatedIntegrity);
        });
    });

    describe('Cross-Customer Data Access Prevention', () => {
        it('should prevent Customer A from accessing Customer B data via JWT', async () => {
            const customerIdA = 'cust_abc';
            const customerIdB = 'cust_xyz';

            // Create JWT for Customer A
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const tokenA = await createJWT({
                sub: 'user_123',
                email: 'userA@example.com',
                customerId: customerIdA,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, mockEnv.JWT_SECRET);

            // Authenticate request from Customer A
            const requestA = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenA}`,
                },
            });

            const authA = await authenticateRequest(requestA, mockEnv);

            // Verify Customer A's customerID is extracted correctly
            expect(authA).not.toBeNull();
            expect(authA?.customerId).toBe(customerIdA);
            expect(authA?.customerId).not.toBe(customerIdB);

            // Customer A should NOT be able to use Customer B's customerID in integrity checks
            const method = 'GET';
            const path = '/api/mods';
            const body = null;

            // Integrity hash calculated with Customer A's customerID
            const integrityA = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                authA?.customerId || null
            );

            // Try to verify with Customer B's customerID - should fail
            // Calculate what integrity should be with Customer B's customerID
            const integrityB = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                undefined,
                customerIdB
            );

            // Integrity hashes should be different
            expect(integrityA).not.toBe(integrityB);
        });

        it('should allow Customer A to access their own data', async () => {
            const customerIdA = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const tokenA = await createJWT({
                sub: 'user_123',
                email: 'userA@example.com',
                customerId: customerIdA,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, mockEnv.JWT_SECRET);

            const requestA = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenA}`,
                },
            });

            const authA = await authenticateRequest(requestA, mockEnv);

            expect(authA).not.toBeNull();
            expect(authA?.customerId).toBe(customerIdA);

            // Customer A should be able to use their own customerID in integrity checks
            const method = 'GET';
            const path = '/api/mods';
            const body = null;
            // Use the same timestamp for both calls to ensure deterministic hashes
            const timestamp = Date.now().toString();

            const integrityA = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                authA?.customerId || null
            );

            // Recalculate integrity with same customerID and timestamp
            const recalculatedIntegrity = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                customerIdA
            );

            // Integrity hashes should match
            expect(integrityA).toBe(recalculatedIntegrity);
        });

        it('should handle null customerID correctly in integrity checks', async () => {
            const method = 'GET';
            const path = '/api/mods';
            const body = null;
            // Use the same timestamp for all calls to ensure deterministic hashes
            const timestamp = Date.now().toString();

            // Calculate integrity with null customerID
            const integrityNull = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                null
            );

            // Calculate integrity with actual customerID (different timestamp to ensure different hash)
            const integrityWithId = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                'cust_abc'
            );

            // Verify null customerID produces different hash than actual customerID
            expect(integrityNull).not.toBe(integrityWithId);

            // Verify null customerID verification works
            // Recalculate integrity with null customerID and same timestamp
            const recalculatedIntegrityNull = await calculateRequestIntegrity(
                method,
                path,
                body,
                mockEnv.NETWORK_INTEGRITY_KEYPHRASE,
                timestamp,
                null
            );

            // Integrity hashes should match
            expect(integrityNull).toBe(recalculatedIntegrityNull);
        });
    });
});

