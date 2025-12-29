/**
 * Unit Tests for Shared Route Protection System
 * 
 * Tests verify that admin route protection works correctly:
 * - Unauthorized requests are rejected
 * - Authorized requests are allowed
 * - Super admin vs regular admin distinction
 * - API key authentication
 * - JWT token authentication
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    protectAdminRoute,
    isSuperAdminEmail,
    isAdminEmail,
    verifySuperAdminKey,
    createUnauthorizedResponse,
    createForbiddenResponse,
    type RouteProtectionEnv,
    type AuthResult,
} from './route-protection.js';

// Mock JWT verification
const mockVerifyJWT = vi.fn();

describe('Route Protection System', () => {
    const mockEnv: RouteProtectionEnv = {
        SUPER_ADMIN_EMAILS: 'superadmin@example.com,admin2@example.com',
        ADMIN_EMAILS: 'regularadmin@example.com,admin3@example.com',
        SUPER_ADMIN_API_KEY: 'super-secret-api-key-123',
        JWT_SECRET: 'test-jwt-secret',
        ALLOWED_ORIGINS: 'https://example.com,https://app.example.com',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockVerifyJWT.mockClear();
    });

    describe('isSuperAdminEmail', () => {
        it('should return true for super admin email', async () => {
            const result = await isSuperAdminEmail('superadmin@example.com', mockEnv);
            expect(result).toBe(true);
        });

        it('should return false for non-super admin email', async () => {
            const result = await isSuperAdminEmail('user@example.com', mockEnv);
            expect(result).toBe(false);
        });

        it('should return false for undefined email', async () => {
            const result = await isSuperAdminEmail(undefined, mockEnv);
            expect(result).toBe(false);
        });

        it('should be case-insensitive', async () => {
            const result = await isSuperAdminEmail('SUPERADMIN@EXAMPLE.COM', mockEnv);
            expect(result).toBe(true);
        });

        it('should handle multiple super admin emails', async () => {
            const result = await isSuperAdminEmail('admin2@example.com', mockEnv);
            expect(result).toBe(true);
        });
    });

    describe('isAdminEmail', () => {
        it('should return true for super admin email', async () => {
            const result = await isAdminEmail('superadmin@example.com', mockEnv);
            expect(result).toBe(true);
        });

        it('should return true for regular admin email', async () => {
            const result = await isAdminEmail('regularadmin@example.com', mockEnv);
            expect(result).toBe(true);
        });

        it('should return false for non-admin email', async () => {
            const result = await isAdminEmail('user@example.com', mockEnv);
            expect(result).toBe(false);
        });

        it('should return false for undefined email', async () => {
            const result = await isAdminEmail(undefined, mockEnv);
            expect(result).toBe(false);
        });
    });

    describe('verifySuperAdminKey', () => {
        it('should return true for valid super admin API key', () => {
            const result = verifySuperAdminKey('super-secret-api-key-123', mockEnv);
            expect(result).toBe(true);
        });

        it('should return false for invalid API key', () => {
            const result = verifySuperAdminKey('wrong-key', mockEnv);
            expect(result).toBe(false);
        });

        it('should return false when no API key is configured', () => {
            const envWithoutKey: RouteProtectionEnv = { ...mockEnv, SUPER_ADMIN_API_KEY: undefined };
            const result = verifySuperAdminKey('any-key', envWithoutKey);
            expect(result).toBe(false);
        });
    });

    describe('protectAdminRoute - Unauthorized Access', () => {
        it('should reject request without authentication', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
            });

            mockVerifyJWT.mockResolvedValue(null);

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(401);
        });

        it('should reject request with invalid JWT token', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer invalid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue(null);

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(401);
        });

        it('should reject regular user for super-admin route', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'user_123',
                email: 'user@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
        });

        it('should reject regular admin for super-admin route', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'admin_123',
                email: 'regularadmin@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
        });
    });

    describe('protectAdminRoute - Authorized Access', () => {
        it('should allow super admin with valid JWT token', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'admin_123',
                email: 'superadmin@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.auth).toBeDefined();
            expect(result.auth?.email).toBe('superadmin@example.com');
            expect(result.level).toBe('super-admin');
        });

        it('should allow super admin with API key', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer super-secret-api-key-123',
                },
            });

            mockVerifyJWT.mockResolvedValue(null);

            const result = await protectAdminRoute(request, mockEnv, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.level).toBe('super-admin');
        });

        it('should allow regular admin for admin-level route', async () => {
            const request = new Request('https://api.example.com/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'admin_123',
                email: 'regularadmin@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, mockEnv, 'admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.auth).toBeDefined();
            expect(result.level).toBe('admin');
        });

        it('should allow super admin for admin-level route (super admins are also admins)', async () => {
            const request = new Request('https://api.example.com/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'admin_123',
                email: 'superadmin@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, mockEnv, 'admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.auth).toBeDefined();
            expect(result.level).toBe('super-admin'); // Super admins get super-admin level
        });
    });

    describe('createUnauthorizedResponse', () => {
        it('should create 401 response with correct headers', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
            });

            const response = createUnauthorizedResponse(request, mockEnv, 'Custom message', 'CUSTOM_CODE');

            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error).toBe('Custom message');
            expect(data.code).toBe('CUSTOM_CODE');
        });
    });

    describe('createForbiddenResponse', () => {
        it('should create 403 response with correct headers', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
            });

            const response = createForbiddenResponse(request, mockEnv, 'Custom forbidden message', 'FORBIDDEN_CODE');

            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Custom forbidden message');
            expect(data.code).toBe('FORBIDDEN_CODE');
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing JWT_SECRET gracefully', async () => {
            const envWithoutSecret: RouteProtectionEnv = {
                ...mockEnv,
                JWT_SECRET: undefined,
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer token',
                },
            });

            mockVerifyJWT.mockResolvedValue(null);

            const result = await protectAdminRoute(request, envWithoutSecret, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
        });

        it('should handle empty admin email lists', async () => {
            const envWithEmptyLists: RouteProtectionEnv = {
                ...mockEnv,
                SUPER_ADMIN_EMAILS: undefined,
                ADMIN_EMAILS: undefined,
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'user_123',
                email: 'user@example.com',
                customerId: 'cust_123',
            });

            const result = await protectAdminRoute(request, envWithEmptyLists, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
        });
    });
});

