/**
 * Integration Tests for Authentication Flow
 * 
 * Tests the complete authentication flow:
 * - OTP request  verify  JWT creation  API access
 * 
 * ⚠ CRITICAL: These tests require LOCAL workers!
 * - OTP Auth Service must be running on http://localhost:8787
 * - Customer API must be running on http://localhost:8790
 * 
 * Workers are automatically started by shared setup file.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { authenticateRequest } from '../utils/auth.js';
import { createJWT } from '@strixun/otp-auth-service/utils/crypto';

const OTP_AUTH_SERVICE_URL = process.env.OTP_AUTH_SERVICE_URL || 'http://localhost:8787';
const CUSTOMER_API_URL = process.env.CUSTOMER_API_URL || 'http://localhost:8790';

// Get secrets from environment (set by shared setup)
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests';

const env = {
    JWT_SECRET,
    ALLOWED_ORIGINS: '*',
    AUTH_API_URL: OTP_AUTH_SERVICE_URL,
} as any;

describe('Authentication Flow Integration', () => {
    beforeAll(async () => {
        // Verify services are running
        try {
            const otpHealth = await fetch(`${OTP_AUTH_SERVICE_URL}/health`, {
                signal: AbortSignal.timeout(3000)
            });
            console.log(`[Auth Flow Tests] ✓ OTP Auth Service is running (status: ${otpHealth.status})`);
        } catch (error: any) {
            throw new Error(
                `✗ OTP Auth Service is not running!\n` +
                `   URL: ${OTP_AUTH_SERVICE_URL}\n` +
                `   Error: ${error.message}\n` +
                `   \n` +
                `   Fix: Workers should start automatically via shared setup.\n` +
                `   If not, check serverless/shared/vitest.setup.integration.ts`
            );
        }
    }, 30000);

    describe('JWT Creation and Verification Flow', () => {
        it('should create JWT token and verify it for API access', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            // Step 1: Create JWT token (simulating OTP verification)
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60); // 7 hours
            const token = await createJWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, env.JWT_SECRET);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3); // JWT has 3 parts

            // Step 2: Use token to authenticate API request
            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            // Step 3: Verify authentication succeeded
            expect(auth).not.toBeNull();
            expect(auth?.userId).toBe(userId);
            expect(auth?.email).toBe(email);
            expect(auth?.customerId).toBe(customerId);
            expect(auth?.jwtToken).toBe(token);
        });

        it('should reject invalid JWT tokens', async () => {
            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer invalid-token-123',
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).toBeNull();
        });

        it('should reject expired JWT tokens', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            // Create expired token (expired 1 hour ago)
            const expiredExp = Math.floor(Date.now() / 1000) - 3600; // Expired 1 hour ago
            const expiredToken = await createJWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: expiredExp,
                iat: Math.floor(Date.now() / 1000) - 7200, // Created 2 hours ago
            }, env.JWT_SECRET);

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${expiredToken}`,
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).toBeNull();
        });

        it('should reject requests without Authorization header', async () => {
            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).toBeNull();
        });

        it('should extract customerID from JWT for integrity verification', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60); // 7 hours
            const token = await createJWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, env.JWT_SECRET);

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            // Verify customerID is extracted for integrity verification
            expect(auth?.customerId).toBe(customerId);
            expect(auth?.customerId).not.toBeNull();
        });

        it('should handle missing customerID in JWT gracefully', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';

            // Create token without customerID
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createJWT({
                sub: userId,
                email: email,
                customerId: null,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, env.JWT_SECRET);

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            // Should still authenticate, but customerID should be null
            expect(auth).not.toBeNull();
            expect(auth?.userId).toBe(userId);
            expect(auth?.customerId).toBeNull();
        });
    });

    describe('End-to-End Authentication Flow', () => {
        it('should complete full flow: OTP  JWT  API access', async () => {
            // Simulate complete flow
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            // Step 1: OTP verification would create JWT (simulated)
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createJWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, env.JWT_SECRET);

            // Step 2: Use JWT to access protected API endpoint
            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const auth = await authenticateRequest(mockRequest, env);

            // Step 3: Verify API access is granted
            expect(auth).not.toBeNull();
            expect(auth?.userId).toBe(userId);
            expect(auth?.email).toBe(email);
            expect(auth?.customerId).toBe(customerId);

            // Step 4: Verify token can be used for subsequent requests
            const secondRequest = new Request('https://example.com/api/mods/123', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const secondAuth = await authenticateRequest(secondRequest, env);
            expect(secondAuth).not.toBeNull();
            expect(secondAuth?.userId).toBe(userId);
        });
    });
});

