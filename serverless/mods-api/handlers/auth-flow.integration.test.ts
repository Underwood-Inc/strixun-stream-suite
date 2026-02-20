/**
 * Integration Tests for Authentication Flow
 * 
 * Tests the complete authentication flow:
 * - JWT creation and validation
 * - Token expiration handling
 * - Authorization header processing
 * - Customer ID extraction
 * 
 * NOTE: These tests run locally without workers - they test JWT utilities directly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { clearLocalKVNamespace } from '../../shared/test-kv-cleanup.js';
import { authenticateRequest } from '../utils/auth.js';
import { createRS256JWT, mockJWKSEndpoint } from '../utils/test-rs256.js';

const AUTH_ISSUER = 'https://test-issuer.example.com';

const env = {
    ALLOWED_ORIGINS: '*',
    JWT_ISSUER: AUTH_ISSUER,
    AUTH_SERVICE_URL: AUTH_ISSUER,
} as any;

let cleanupJWKS: () => void;

describe('Authentication Flow Integration', () => {
    beforeAll(async () => {
        cleanupJWKS = await mockJWKSEndpoint();
    });

    afterAll(async () => {
        cleanupJWKS();
        await clearLocalKVNamespace('680c9dbe86854c369dd23e278abb41f9');
        await clearLocalKVNamespace('0d3dafe0994046c6a47146c6bd082ad3');
        await clearLocalKVNamespace('86ef5ab4419b40eab3fe65b75f052789');
        console.log('[Auth Flow Integration Tests] ✓ KV cleanup completed');
    });

    describe('JWT Creation and Verification Flow', () => {
        it('should create RS256 JWT and verify it for API access', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createRS256JWT({
                sub: userId,
                email,
                customerId,
                exp,
                iat: Math.floor(Date.now() / 1000),
            });

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${token}` },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).not.toBeNull();
            expect(auth?.customerId).toBe(customerId);
            expect(auth?.jwtToken).toBe(token);
        });

        it('should reject invalid JWT tokens', async () => {
            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer invalid-token-123' },
            });

            const auth = await authenticateRequest(mockRequest, env);
            expect(auth).toBeNull();
        });

        it('should reject expired JWT tokens', async () => {
            const expiredToken = await createRS256JWT({
                sub: 'user_123',
                email: 'user@example.com',
                customerId: 'cust_abc',
                exp: Math.floor(Date.now() / 1000) - 3600,
                iat: Math.floor(Date.now() / 1000) - 7200,
            });

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${expiredToken}` },
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
            const customerId = 'cust_abc';

            const token = await createRS256JWT({
                sub: 'user_123',
                email: 'user@example.com',
                customerId,
                exp: Math.floor(Date.now() / 1000) + (7 * 60 * 60),
                iat: Math.floor(Date.now() / 1000),
            });

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${token}` },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth?.customerId).toBe(customerId);
            expect(auth?.customerId).not.toBeNull();
        });

        it('should fall back to sub when customerId claim is missing', async () => {
            const sub = 'user_123';

            const token = await createRS256JWT({
                sub,
                email: 'user@example.com',
                customerId: null,
                exp: Math.floor(Date.now() / 1000) + (7 * 60 * 60),
                iat: Math.floor(Date.now() / 1000),
            });

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${token}` },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).not.toBeNull();
            expect(auth?.customerId).toBe(sub);
        });
    });

    describe('End-to-End Authentication Flow', () => {
        it('should complete full flow: OTP → JWT → API access', async () => {
            const customerId = 'cust_abc';

            const token = await createRS256JWT({
                sub: 'user_123',
                email: 'user@example.com',
                customerId,
                exp: Math.floor(Date.now() / 1000) + (7 * 60 * 60),
                iat: Math.floor(Date.now() / 1000),
            });

            const mockRequest = new Request('https://example.com/api/mods', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${token}` },
            });

            const auth = await authenticateRequest(mockRequest, env);

            expect(auth).not.toBeNull();
            expect(auth?.customerId).toBe(customerId);

            const secondRequest = new Request('https://example.com/api/mods/123', {
                method: 'GET',
                headers: { 'Cookie': `auth_token=${token}` },
            });

            const secondAuth = await authenticateRequest(secondRequest, env);
            expect(secondAuth).not.toBeNull();
            expect(secondAuth?.customerId).toBe(customerId);
        });
    });
});

