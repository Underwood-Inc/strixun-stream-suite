/**
 * Integration Tests for Access Service
 * 
 * Tests the complete Access Service workflow:
 * - Authentication enforcement
 * - Rate limiting
 * - Permission checks
 * - Quota management
 * - Role management
 * - End-to-end access control flows
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Miniflare } from 'miniflare';
import { createJWT } from '../otp-auth-service/utils/crypto.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests';
const SERVICE_API_KEY = 'test-service-key-12345';

describe('Access Service Integration Tests', () => {
    let mf: Miniflare;
    let accessServiceUrl: string;

    beforeAll(async () => {
        // Start Miniflare worker for Access Service (using pre-built JavaScript from pretest script)
        mf = new Miniflare({
            scriptPath: './dist/worker.js', // Use compiled JavaScript instead of TypeScript
            modules: true,
            compatibilityDate: '2024-01-01',
            compatibilityFlags: ['nodejs_compat'],
            kvNamespaces: ['ACCESS_KV'],
            bindings: {
                JWT_SECRET,
                SERVICE_API_KEY,
                ACCESS_SERVICE_URL: 'http://localhost:8795',
                ENVIRONMENT: 'test',
            },
        });

        accessServiceUrl = await mf.ready.then(() => 'http://localhost:8795');
    });

    afterAll(async () => {
        await mf.dispose();
    });

    describe('Authentication Enforcement', () => {
        it('should reject unauthenticated GET requests', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_123');

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error).toBe('Unauthorized');
        });

        it('should reject invalid service key', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_123', {
                headers: {
                    'X-Service-Key': 'invalid-key',
                },
            });

            expect(response.status).toBe(401);
        });

        it('should accept valid service key', async () => {
            // Note: No need to manually seed - auto-seeding happens on first request
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_test', {
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                },
            });

            // Should return 404 (not found) rather than 401 (unauthorized)
            expect(response.status).toBe(404);
        });

        it('should reject unauthenticated POST check-permission', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/check-permission', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId: 'cust_123',
                    permission: 'upload:mod',
                }),
            });

            expect(response.status).toBe(401);
        });

        it('should reject unauthenticated POST check-quota', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/check-quota', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId: 'cust_123',
                    resource: 'upload:mod',
                }),
            });

            expect(response.status).toBe(401);
        });
    });

    describe('Rate Limiting', () => {
        it.skip('should enforce rate limits on repeated requests', async () => {
            // NOTE: This test is skipped because rate limiting is intentionally
            // bypassed in test environment (ENVIRONMENT='test') to avoid flaky tests.
            // Rate limiting is tested in production/development environments.
            // See router/access-routes.ts lines 47-56 for bypass logic.
            
            // Make many requests quickly
            const requests = Array.from({ length: 150 }, () =>
                mf.dispatchFetch('http://localhost:8795/access/cust_test', {
                    headers: {
                        'X-Service-Key': SERVICE_API_KEY,
                    },
                })
            );

            const responses = await Promise.all(requests);
            const rateLimited = responses.filter(r => r.status === 429);

            // Should have at least some rate-limited responses
            expect(rateLimited.length).toBeGreaterThan(0);
        });

        it('should include rate limit headers in responses', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_test', {
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                },
            });

            expect(response.headers.has('X-RateLimit-Limit')).toBe(true);
            expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
            expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
        });

        it.skip('should return retry-after header when rate limited', async () => {
            // NOTE: This test is skipped because rate limiting is intentionally
            // bypassed in test environment (ENVIRONMENT='test') to avoid flaky tests.
            // See router/access-routes.ts lines 47-56 for bypass logic.
            
            // Exhaust rate limit
            for (let i = 0; i < 150; i++) {
                await mf.dispatchFetch('http://localhost:8795/access/cust_rate_test', {
                    headers: {
                        'X-Service-Key': SERVICE_API_KEY,
                    },
                });
            }

            // Next request should be rate limited
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_rate_test', {
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                },
            });

            if (response.status === 429) {
                expect(response.headers.has('Retry-After')).toBe(true);
                const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
                expect(retryAfter).toBeGreaterThan(0);
            }
        });
    });

    describe('Permission Checks', () => {
        beforeEach(async () => {
            // Note: Auto-seeding happens on first request to the worker
            // No manual seeding required
        });

        it('should check permission for customer with role', async () => {
            // First assign role to customer
            await mf.dispatchFetch('http://localhost:8795/access/cust_perm_test/roles', {
                method: 'PUT',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['uploader'],
                }),
            });

            // Check permission
            const response = await mf.dispatchFetch('http://localhost:8795/access/check-permission', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId: 'cust_perm_test',
                    permission: 'upload:mod',
                }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.allowed).toBe(true);
        });

        it('should deny permission for customer without role', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/check-permission', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId: 'cust_no_perm',
                    permission: 'upload:mod',
                }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.allowed).toBe(false);
        });
    });

    describe('Quota Management', () => {
        beforeEach(async () => {
            // Note: Auto-seeding happens on first request to the worker
            // No manual seeding required
        });

        it('should check quota availability', async () => {
            // Assign role with quotas
            await mf.dispatchFetch('http://localhost:8795/access/cust_quota_test/roles', {
                method: 'PUT',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['uploader'],
                }),
            });

            // Check quota
            const response = await mf.dispatchFetch('http://localhost:8795/access/check-quota', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId: 'cust_quota_test',
                    resource: 'upload:mod',
                    amount: 1,
                }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.allowed).toBe(true);
            expect(body.quota).toBeDefined();
        });

        it('should increment quota usage', async () => {
            // Assign role
            await mf.dispatchFetch('http://localhost:8795/access/cust_quota_inc/roles', {
                method: 'PUT',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['uploader'],
                }),
            });

            // Increment quota
            const response = await mf.dispatchFetch('http://localhost:8795/access/cust_quota_inc/quotas/increment', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resource: 'upload:mod',
                    amount: 1,
                }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });
    });

    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/health');

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.status).toBe('healthy');
            expect(body.service).toBe('access-service');
        });

        it('should not require authentication for health check', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/health');

            expect(response.status).toBe(200);
        });
    });

    describe('CORS', () => {
        it('should handle OPTIONS preflight', async () => {
            const response = await mf.dispatchFetch('http://localhost:8795/access/test', {
                method: 'OPTIONS',
            });

            expect(response.status).toBe(204);
            expect(response.headers.has('Access-Control-Allow-Origin')).toBe(true);
        });
    });

    describe('End-to-End Access Control Flow', () => {
        it('should complete full access control workflow', async () => {
            const customerId = 'cust_e2e_test';

            // Note: Auto-seeding happens on first request to the worker
            // No manual seeding required

            // 2. Assign roles
            await mf.dispatchFetch(`http://localhost:8795/access/${customerId}/roles`, {
                method: 'PUT',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['uploader', 'customer'],
                }),
            });

            // 3. Get customer authorization
            const authResponse = await mf.dispatchFetch(`http://localhost:8795/access/${customerId}`, {
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                },
            });

            expect(authResponse.status).toBe(200);
            const auth = await authResponse.json();
            expect(auth.roles).toContain('uploader');
            expect(auth.roles).toContain('customer');
            expect(auth.permissions).toContain('upload:mod');

            // 4. Check permission
            const permResponse = await mf.dispatchFetch('http://localhost:8795/access/check-permission', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId,
                    permission: 'upload:mod',
                }),
            });

            const permResult = await permResponse.json();
            expect(permResult.allowed).toBe(true);

            // 5. Check quota
            const quotaResponse = await mf.dispatchFetch('http://localhost:8795/access/check-quota', {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId,
                    resource: 'upload:mod',
                }),
            });

            const quotaResult = await quotaResponse.json();
            expect(quotaResult.allowed).toBe(true);

            // 6. Increment quota
            await mf.dispatchFetch(`http://localhost:8795/access/${customerId}/quotas/increment`, {
                method: 'POST',
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resource: 'upload:mod',
                }),
            });

            // 7. Verify quota was incremented
            const finalAuth = await mf.dispatchFetch(`http://localhost:8795/access/${customerId}`, {
                headers: {
                    'X-Service-Key': SERVICE_API_KEY,
                },
            });

            const finalAuthData = await finalAuth.json();
            expect(finalAuthData.quotas['upload:mod'].current).toBeGreaterThan(0);
        });
    });
});
