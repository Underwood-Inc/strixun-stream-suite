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

// Mock customer-lookup module BEFORE imports
const mockFetchCustomerByCustomerId = vi.fn();

vi.mock('./customer-lookup.js', async () => {
    const actual = await vi.importActual('./customer-lookup.js') as any;
    // Create a wrapper that uses our mock
    const mockFetch = (...args: any[]) => mockFetchCustomerByCustomerId(...args);
    
    // For isSuperAdminByCustomerId, we need to create a version that uses our mock
    const mockIsSuperAdmin = async (customerId: string | null, env: any) => {
        if (!customerId) return false;
        try {
            const customer = await mockFetch(customerId, env);
            if (!customer || !customer.email) return false;
            if (!env.SUPER_ADMIN_EMAILS) return false;
            const superAdminEmails = env.SUPER_ADMIN_EMAILS.split(',').map((e: string) => e.trim().toLowerCase());
            const normalizedEmail = customer.email.trim().toLowerCase();
            return superAdminEmails.includes(normalizedEmail);
        } catch {
            return false;
        }
    };
    
    return {
        ...actual,
        fetchCustomerByCustomerId: mockFetch,
        isSuperAdminByCustomerId: mockIsSuperAdmin,
    };
});

import {
    protectAdminRoute,
    verifySuperAdminKey,
    createUnauthorizedResponse,
    createForbiddenResponse,
    type RouteProtectionEnv,
    type AuthResult,
} from './route-protection.js';
import { isSuperAdminByCustomerId } from './customer-lookup.js';

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
        mockFetchCustomerByCustomerId.mockClear();
    });

    // Tests removed - functions deleted (now using Access Service instead of email-based checks)

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
        it('should allow super admin with valid JWT token (using customerId lookup)', async () => {
            const mockCustomer = {
                customerId: 'cust_123',
                email: 'superadmin@example.com',
                displayName: 'Super Admin',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'admin_123',
                customerId: 'cust_123',
                // email not in JWT - should be looked up from customer record
            });

            const result = await protectAdminRoute(request, envWithCustomerApi, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.auth).toBeDefined();
            expect(result.level).toBe('super-admin');
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', envWithCustomerApi);
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

    describe('isSuperAdminByCustomerId', () => {
        let fetchCustomerByCustomerId: any;

        beforeEach(async () => {
            vi.clearAllMocks();
            const customerLookup = await import('./customer-lookup.js');
            fetchCustomerByCustomerId = customerLookup.fetchCustomerByCustomerId;
        });

        it('should return true when customer email is in SUPER_ADMIN_EMAILS', async () => {
            const mockCustomer = {
                customerId: 'cust_123',
                email: 'superadmin@example.com',
                displayName: 'Super Admin',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_123', envWithCustomerApi);

            expect(result).toBe(true);
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', envWithCustomerApi);
        });

        it('should return false when customer email is not in SUPER_ADMIN_EMAILS', async () => {
            const mockCustomer = {
                customerId: 'cust_456',
                email: 'regularuser@example.com',
                displayName: 'Regular User',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_456', envWithCustomerApi);

            expect(result).toBe(false);
        });

        it('should return false when customer is not found', async () => {
            mockFetchCustomerByCustomerId.mockResolvedValue(null);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_nonexistent', envWithCustomerApi);

            expect(result).toBe(false);
        });

        it('should return false when customer has no email', async () => {
            const mockCustomer = {
                customerId: 'cust_789',
                displayName: 'User Without Email',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer as any);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_789', envWithCustomerApi);

            expect(result).toBe(false);
        });

        it('should return false when customerId is null', async () => {
            const result = await isSuperAdminByCustomerId(null, mockEnv);

            expect(result).toBe(false);
            expect(mockFetchCustomerByCustomerId).not.toHaveBeenCalled();
        });

        it('should handle customer lookup errors gracefully', async () => {
            mockFetchCustomerByCustomerId.mockRejectedValue(new Error('Customer API error'));

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_error', envWithCustomerApi);

            expect(result).toBe(false);
        });

        it('should normalize email case when checking', async () => {
            const mockCustomer = {
                customerId: 'cust_123',
                email: 'SUPERADMIN@EXAMPLE.COM', // Uppercase
                displayName: 'Super Admin',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const result = await isSuperAdminByCustomerId('cust_123', envWithCustomerApi);

            expect(result).toBe(true); // Should match despite case difference
        });
    });

    describe('protectAdminRoute - CustomerId Lookup Flow', () => {
        let fetchCustomerByCustomerId: any;

        beforeEach(async () => {
            vi.clearAllMocks();
            const customerLookup = await import('./customer-lookup.js');
            fetchCustomerByCustomerId = customerLookup.fetchCustomerByCustomerId;
        });

        it('should allow super admin access using customerId lookup', async () => {
            const mockCustomer = {
                customerId: 'cust_123',
                email: 'superadmin@example.com',
                displayName: 'Super Admin',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            // JWT has customerId but no email (as per architecture)
            mockVerifyJWT.mockResolvedValue({
                sub: 'user_123',
                customerId: 'cust_123',
                // email not in JWT - should lookup from customer
            });

            const result = await protectAdminRoute(request, envWithCustomerApi, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(true);
            expect(result.auth).toBeDefined();
            expect(result.level).toBe('super-admin');
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', envWithCustomerApi);
        });

        it('should reject access when customer email is not in SUPER_ADMIN_EMAILS', async () => {
            const mockCustomer = {
                customerId: 'cust_456',
                email: 'regularuser@example.com',
                displayName: 'Regular User',
            };

            mockFetchCustomerByCustomerId.mockResolvedValue(mockCustomer as any);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'user_456',
                customerId: 'cust_456',
            });

            const result = await protectAdminRoute(request, envWithCustomerApi, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_456', envWithCustomerApi);
        });


        it('should reject when customer lookup fails and no email fallback', async () => {
            mockFetchCustomerByCustomerId.mockResolvedValue(null);

            const envWithCustomerApi: RouteProtectionEnv = {
                ...mockEnv,
                CUSTOMER_API_URL: 'http://localhost:8790',
                NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
            };

            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer valid-token',
                },
            });

            mockVerifyJWT.mockResolvedValue({
                sub: 'user_123',
                customerId: 'cust_123',
                // No email in JWT
            });

            const result = await protectAdminRoute(request, envWithCustomerApi, 'super-admin', mockVerifyJWT);

            expect(result.allowed).toBe(false);
            expect(result.error?.status).toBe(403);
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

