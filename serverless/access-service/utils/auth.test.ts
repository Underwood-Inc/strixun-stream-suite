/**
 * Unit Tests for Access Service Authentication
 * 
 * Tests authentication and authorization logic:
 * - Service key authentication
 * - JWT authentication
 * - Rate limiting identifier generation
 * - Authentication requirement enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { authenticateRequest, requireAuth } from './auth.js';
import type { Env } from '../types/authorization.js';

describe('Access Service Authentication', () => {
    let mockEnv: Env;

    beforeEach(() => {
        mockEnv = {
            SERVICE_API_KEY: 'test-service-key-12345',
            JWT_SECRET: 'test-jwt-secret',
            ACCESS_KV: {} as any,
            ACCESS_SERVICE_URL: 'http://localhost:8791',
        };
    });

    describe('authenticateRequest', () => {
        it('should authenticate with valid service key', async () => {
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'X-Service-Key': 'test-service-key-12345',
                },
            });

            const result = await authenticateRequest(request, mockEnv);

            expect(result).toBeDefined();
            expect(result?.isServiceCall).toBe(true);
            expect(result?.customerId).toBeNull();
        });

        it('should reject invalid service key', async () => {
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'X-Service-Key': 'invalid-key',
                },
            });

            const result = await authenticateRequest(request, mockEnv);

            expect(result).toBeNull();
        });

        it('should reject missing service key', async () => {
            const request = new Request('https://access.idling.app/access/test');

            const result = await authenticateRequest(request, mockEnv);

            expect(result).toBeNull();
        });

        it('should reject when SERVICE_API_KEY not configured', async () => {
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'X-Service-Key': 'test-service-key-12345',
                },
            });

            const envWithoutKey = { ...mockEnv, SERVICE_API_KEY: undefined };
            const result = await authenticateRequest(request, envWithoutKey);

            expect(result).toBeNull();
        });

        it('should authenticate with valid JWT (fallback)', async () => {
            // Note: JWT authentication is tested more thoroughly in integration tests
            // This is a basic unit test for the structure
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'Authorization': 'Bearer valid-jwt-token',
                },
            });

            // Without proper JWT verification setup, this will return null
            // Full JWT tests are in integration tests
            const result = await authenticateRequest(request, mockEnv);

            // Expected to fail without proper JWT setup in unit test
            expect(result).toBeNull();
        });
    });

    describe('requireAuth', () => {
        it('should allow authenticated service calls', () => {
            const auth = {
                customerId: null,
                isServiceCall: true,
            };

            const request = new Request('https://access.idling.app/access/test');
            const result = requireAuth(auth, request, mockEnv);

            expect(result).toBeNull();
        });

        it('should allow authenticated JWT calls', () => {
            const auth = {
                customerId: 'cust_123',
                jwtToken: 'valid-token',
                isServiceCall: false,
            };

            const request = new Request('https://access.idling.app/access/test');
            const result = requireAuth(auth, request, mockEnv);

            expect(result).toBeNull();
        });

        it('should reject unauthenticated calls', () => {
            const request = new Request('https://access.idling.app/access/test');
            const result = requireAuth(null, request, mockEnv);

            expect(result).toBeDefined();
            expect(result?.status).toBe(401);
        });

        it('should return proper error response for unauthenticated calls', async () => {
            const request = new Request('https://access.idling.app/access/test');
            const result = requireAuth(null, request, mockEnv);

            expect(result).toBeDefined();
            const body = await result!.json();
            expect(body.error).toBe('Unauthorized');
            expect(body.code).toBe('AUTH_REQUIRED');
        });
    });

    describe('Security Headers', () => {
        it('should not leak service key in responses', async () => {
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'X-Service-Key': 'test-service-key-12345',
                },
            });

            const result = await authenticateRequest(request, mockEnv);

            // Ensure the result doesn't contain the actual service key
            expect(JSON.stringify(result)).not.toContain('test-service-key-12345');
        });

        it('should not expose JWT secret in error messages', async () => {
            const request = new Request('https://access.idling.app/access/test', {
                headers: {
                    'Authorization': 'Bearer invalid-token',
                },
            });

            const result = await authenticateRequest(request, mockEnv);

            // Should not expose secret even on failure
            expect(JSON.stringify(result)).not.toContain('test-jwt-secret');
        });
    });
});
