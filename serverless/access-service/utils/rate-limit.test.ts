/**
 * Unit Tests for Rate Limiting
 * 
 * Tests rate limiting logic:
 * - Sliding window algorithm
 * - Rate limit enforcement
 * - Identifier generation
 * - Header generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    checkRateLimit, 
    getRateLimitIdentifier, 
    createRateLimitError, 
    addRateLimitHeaders,
    RATE_LIMITS 
} from './rate-limit.js';
import type { Env } from '../types/authorization.js';

describe('Rate Limiting', () => {
    let mockEnv: Env;
    let mockKV: Map<string, any>;

    beforeEach(() => {
        mockKV = new Map();
        mockEnv = {
            ACCESS_KV: {
                get: vi.fn((key: string) => {
                    const value = mockKV.get(key);
                    return Promise.resolve(value ? JSON.stringify(value) : null);
                }),
                put: vi.fn((key: string, value: string) => {
                    mockKV.set(key, JSON.parse(value));
                    return Promise.resolve();
                }),
            } as any,
            SERVICE_API_KEY: 'test-key',
            JWT_SECRET: 'test-secret',
            ACCESS_SERVICE_URL: 'http://localhost:8791',
        };
    });

    describe('checkRateLimit', () => {
        it('should allow requests under limit', async () => {
            const config = { maxRequests: 5, windowSeconds: 60, keyPrefix: 'test' };
            const result = await checkRateLimit('user_123', config, mockEnv);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4); // 5 - 1 = 4
        });

        it('should block requests over limit', async () => {
            const config = { maxRequests: 2, windowSeconds: 60, keyPrefix: 'test' };

            // Make 2 requests (should succeed)
            await checkRateLimit('user_123', config, mockEnv);
            await checkRateLimit('user_123', config, mockEnv);

            // 3rd request should be blocked
            const result = await checkRateLimit('user_123', config, mockEnv);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.retryAfter).toBeGreaterThan(0);
        });

        it('should use sliding window (old requests expire)', async () => {
            const config = { maxRequests: 2, windowSeconds: 1, keyPrefix: 'test' }; // 1 second window

            // Make 2 requests
            await checkRateLimit('user_123', config, mockEnv);
            await checkRateLimit('user_123', config, mockEnv);

            // Wait for window to expire (simulate by manipulating stored data)
            const key = 'test_user_123';
            const oldData = mockKV.get(key);
            if (oldData) {
                // Make requests appear old (outside window)
                oldData.requests = oldData.requests.map(() => Date.now() - 2000);
                mockKV.set(key, oldData);
            }

            // Should allow new request after window expires
            const result = await checkRateLimit('user_123', config, mockEnv);
            expect(result.allowed).toBe(true);
        });

        it('should handle different identifiers separately', async () => {
            const config = { maxRequests: 1, windowSeconds: 60, keyPrefix: 'test' };

            // User 1 makes request
            const result1 = await checkRateLimit('user_123', config, mockEnv);
            expect(result1.allowed).toBe(true);

            // User 2 should still be able to make request
            const result2 = await checkRateLimit('user_456', config, mockEnv);
            expect(result2.allowed).toBe(true);
        });

        it('should calculate correct remaining count', async () => {
            const config = { maxRequests: 5, windowSeconds: 60, keyPrefix: 'test' };

            let result = await checkRateLimit('user_123', config, mockEnv);
            expect(result.remaining).toBe(4);

            result = await checkRateLimit('user_123', config, mockEnv);
            expect(result.remaining).toBe(3);

            result = await checkRateLimit('user_123', config, mockEnv);
            expect(result.remaining).toBe(2);
        });

        it('should provide retry-after when blocked', async () => {
            const config = { maxRequests: 1, windowSeconds: 60, keyPrefix: 'test' };

            await checkRateLimit('user_123', config, mockEnv);
            const result = await checkRateLimit('user_123', config, mockEnv);

            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.retryAfter).toBeLessThanOrEqual(60);
        });
    });

    describe('getRateLimitIdentifier', () => {
        it('should prioritize service key', () => {
            const request = new Request('https://access.idling.app/test', {
                headers: {
                    'X-Service-Key': 'service-key-12345',
                    'CF-Connecting-IP': '1.2.3.4',
                },
            });

            const auth = { customerId: 'cust_123', isServiceCall: true };
            const identifier = getRateLimitIdentifier(request, auth);

            expect(identifier).toContain('service_');
            expect(identifier).not.toContain('cust_123');
            expect(identifier).not.toContain('1.2.3.4');
        });

        it('should use customer ID if no service key', () => {
            const request = new Request('https://access.idling.app/test', {
                headers: {
                    'CF-Connecting-IP': '1.2.3.4',
                },
            });

            const auth = { customerId: 'cust_123', isServiceCall: false, jwtToken: 'token' };
            const identifier = getRateLimitIdentifier(request, auth);

            expect(identifier).toBe('customer_cust_123');
        });

        it('should fall back to IP if no auth', () => {
            const request = new Request('https://access.idling.app/test', {
                headers: {
                    'CF-Connecting-IP': '1.2.3.4',
                },
            });

            const identifier = getRateLimitIdentifier(request, null);

            expect(identifier).toBe('ip_1.2.3.4');
        });

        it('should handle X-Forwarded-For fallback', () => {
            const request = new Request('https://access.idling.app/test', {
                headers: {
                    'X-Forwarded-For': '5.6.7.8',
                },
            });

            const identifier = getRateLimitIdentifier(request, null);

            expect(identifier).toBe('ip_5.6.7.8');
        });

        it('should handle missing IP gracefully', () => {
            const request = new Request('https://access.idling.app/test');

            const identifier = getRateLimitIdentifier(request, null);

            expect(identifier).toBe('ip_unknown');
        });
    });

    describe('createRateLimitError', () => {
        it('should create 429 response', () => {
            const rateLimitResult = {
                allowed: false,
                remaining: 0,
                resetAt: new Date().toISOString(),
                retryAfter: 30,
            };

            const response = createRateLimitError(rateLimitResult);

            expect(response.status).toBe(429);
        });

        it('should include retry-after header', () => {
            const rateLimitResult = {
                allowed: false,
                remaining: 0,
                resetAt: new Date().toISOString(),
                retryAfter: 45,
            };

            const response = createRateLimitError(rateLimitResult);

            expect(response.headers.get('Retry-After')).toBe('45');
        });

        it('should include rate limit headers', () => {
            const rateLimitResult = {
                allowed: false,
                remaining: 0,
                resetAt: '2026-01-10T12:00:00Z',
                retryAfter: 60,
            };

            const response = createRateLimitError(rateLimitResult);

            expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(response.headers.get('X-RateLimit-Reset')).toBe('2026-01-10T12:00:00Z');
        });

        it('should include error details in body', async () => {
            const rateLimitResult = {
                allowed: false,
                remaining: 0,
                resetAt: '2026-01-10T12:00:00Z',
                retryAfter: 30,
            };

            const response = createRateLimitError(rateLimitResult);
            const body = await response.json();

            expect(body.error).toBe('Too Many Requests');
            expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(body.retryAfter).toBe(30);
        });
    });

    describe('addRateLimitHeaders', () => {
        it('should add rate limit headers to response', () => {
            const originalResponse = new Response('OK', { status: 200 });
            const rateLimitResult = {
                allowed: true,
                remaining: 5,
                resetAt: '2026-01-10T12:00:00Z',
            };

            const response = addRateLimitHeaders(originalResponse, rateLimitResult, 10);

            expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
            expect(response.headers.get('X-RateLimit-Remaining')).toBe('5');
            expect(response.headers.get('X-RateLimit-Reset')).toBe('2026-01-10T12:00:00Z');
        });

        it('should preserve original response body and status', async () => {
            const originalResponse = new Response(JSON.stringify({ data: 'test' }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
            const rateLimitResult = {
                allowed: true,
                remaining: 3,
                resetAt: '2026-01-10T12:00:00Z',
            };

            const response = addRateLimitHeaders(originalResponse, rateLimitResult, 10);

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            const body = await response.json();
            expect(body.data).toBe('test');
        });
    });

    describe('RATE_LIMITS configuration', () => {
        it('should have sensible defaults for read operations', () => {
            expect(RATE_LIMITS.read.maxRequests).toBeGreaterThan(0);
            expect(RATE_LIMITS.read.windowSeconds).toBeGreaterThan(0);
            expect(RATE_LIMITS.read.maxRequests).toBeGreaterThan(RATE_LIMITS.write.maxRequests);
        });

        it('should have stricter limits for write operations', () => {
            expect(RATE_LIMITS.write.maxRequests).toBeLessThan(RATE_LIMITS.read.maxRequests);
        });

        it('should have strictest limits for admin operations', () => {
            expect(RATE_LIMITS.admin.maxRequests).toBeLessThan(RATE_LIMITS.write.maxRequests);
            expect(RATE_LIMITS.admin.maxRequests).toBeLessThan(RATE_LIMITS.read.maxRequests);
        });
    });
});
