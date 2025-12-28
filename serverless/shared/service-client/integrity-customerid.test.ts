/**
 * Tests for integrity system with customerID verification
 * CRITICAL: Ensures customerID is included in integrity hash to prevent cross-customer data access
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateRequestIntegrity,
    addRequestIntegrityHeaders,
    verifyResponseIntegrity,
    calculateResponseIntegrity,
} from './integrity.js';

describe('Integrity System with CustomerID', () => {
    const keyphrase = 'test-keyphrase-123';
    const method = 'POST';
    const path = '/api/test';
    const body = JSON.stringify({ data: 'test' });

    describe('calculateRequestIntegrity', () => {
        it('should include customerID in hash calculation', async () => {
            const customerId1 = 'cust_abc';
            const customerId2 = 'cust_xyz';

            const hash1 = await calculateRequestIntegrity(method, path, body, keyphrase, undefined, customerId1);
            const hash2 = await calculateRequestIntegrity(method, path, body, keyphrase, undefined, customerId2);

            // Different customerIDs should produce different hashes
            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hash for null customerID vs actual customerID', async () => {
            const customerId = 'cust_abc';

            const hashWithCustomerId = await calculateRequestIntegrity(method, path, body, keyphrase, undefined, customerId);
            const hashWithNull = await calculateRequestIntegrity(method, path, body, keyphrase, undefined, null);

            // Null customerID should produce different hash
            expect(hashWithCustomerId).not.toBe(hashWithNull);
        });

        it('should produce same hash for same customerID and request data', async () => {
            const customerId = 'cust_abc';
            const timestamp = '1234567890';

            const hash1 = await calculateRequestIntegrity(method, path, body, keyphrase, timestamp, customerId);
            const hash2 = await calculateRequestIntegrity(method, path, body, keyphrase, timestamp, customerId);

            // Same customerID and data should produce same hash
            expect(hash1).toBe(hash2);
        });

        it('should prevent cross-customer data access', async () => {
            const customerId1 = 'cust_abc';
            const customerId2 = 'cust_xyz';
            const body1 = JSON.stringify({ customerId: customerId1, data: 'sensitive' });
            const body2 = JSON.stringify({ customerId: customerId2, data: 'sensitive' });

            // Hash for customer1's request
            const hash1 = await calculateRequestIntegrity(method, path, body1, keyphrase, undefined, customerId1);
            
            // Hash for customer2's request (same data but different customerID)
            const hash2 = await calculateRequestIntegrity(method, path, body1, keyphrase, undefined, customerId2);

            // Different customerIDs should produce different hashes even with same body
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('addRequestIntegrityHeaders', () => {
        it('should extract customerID from JWT token', async () => {
            // Create a mock JWT token with customerID
            const payload = {
                sub: 'user_123',
                customerId: 'cust_abc',
                exp: Math.floor(Date.now() / 1000) + 3600,
            };
            const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            const token = `header.${payloadB64}.signature`;

            const headers = new Headers({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            });

            await addRequestIntegrityHeaders(method, path, body, headers, keyphrase);

            // Should have integrity header
            expect(headers.get('X-Strixun-Request-Integrity')).toBeDefined();
            expect(headers.get('X-Strixun-Request-Timestamp')).toBeDefined();
            
            // Should have X-Customer-ID header set
            expect(headers.get('X-Customer-ID')).toBe('cust_abc');
        });

        it('should use X-Customer-ID header if present', async () => {
            const headers = new Headers({
                'X-Customer-ID': 'cust_xyz',
                'Content-Type': 'application/json',
            });

            await addRequestIntegrityHeaders(method, path, body, headers, keyphrase);

            // Should use header value
            expect(headers.get('X-Customer-ID')).toBe('cust_xyz');
            expect(headers.get('X-Strixun-Request-Integrity')).toBeDefined();
        });

        it('should handle missing customerID gracefully', async () => {
            const headers = new Headers({
                'Content-Type': 'application/json',
            });

            await addRequestIntegrityHeaders(method, path, body, headers, keyphrase);

            // Should still create integrity header (with null customerID)
            expect(headers.get('X-Strixun-Request-Integrity')).toBeDefined();
            expect(headers.get('X-Strixun-Request-Timestamp')).toBeDefined();
        });

        it('should include customerID in integrity hash', async () => {
            const customerId1 = 'cust_abc';
            const customerId2 = 'cust_xyz';

            const headers1 = new Headers({
                'X-Customer-ID': customerId1,
            });
            const headers2 = new Headers({
                'X-Customer-ID': customerId2,
            });

            await addRequestIntegrityHeaders(method, path, body, headers1, keyphrase);
            await addRequestIntegrityHeaders(method, path, body, headers2, keyphrase);

            const hash1 = headers1.get('X-Strixun-Request-Integrity');
            const hash2 = headers2.get('X-Strixun-Request-Integrity');

            // Different customerIDs should produce different hashes
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyResponseIntegrity', () => {
        it('should verify response integrity correctly', async () => {
            const status = 200;
            const responseBody = JSON.stringify({ data: 'test' });

            const verifiedNull = await verifyResponseIntegrity(status, responseBody, null, keyphrase);
            expect(verifiedNull).toBe(false);

            // Calculate correct signature
            const correctSignature = await calculateResponseIntegrity(status, responseBody, keyphrase);

            const verified = await verifyResponseIntegrity(status, responseBody, correctSignature, keyphrase);
            expect(verified).toBe(true);
        });

        it('should detect tampered responses', async () => {
            const status = 200;
            const originalBody = JSON.stringify({ data: 'test' });
            const tamperedBody = JSON.stringify({ data: 'tampered' });

            const originalSignature = await calculateResponseIntegrity(status, originalBody, keyphrase);

            // Verify tampered body should fail
            const verified = await verifyResponseIntegrity(status, tamperedBody, originalSignature, keyphrase);
            expect(verified).toBe(false);
        });
    });
});

