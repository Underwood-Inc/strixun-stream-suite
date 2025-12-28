/**
 * Integration Tests for OTP Auth Service Admin Routes
 * 
 * Tests verify that all admin routes are properly protected:
 * - Unauthorized requests are rejected
 * - Authorized super admin requests are allowed
 * - All routes return appropriate responses
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAdminRoutes } from './admin-routes.js';

// Mock dependencies
vi.mock('../utils/super-admin.js', () => ({
    requireSuperAdmin: vi.fn(),
    verifySuperAdmin: vi.fn(),
}));

vi.mock('../utils/crypto.js', () => ({
    verifyJWT: vi.fn(),
    getJWTSecret: vi.fn().mockReturnValue('test-secret'),
    hashEmail: vi.fn().mockResolvedValue('hashed-token'),
}));

vi.mock('../services/customer.js', () => ({
    getCustomerKey: vi.fn().mockReturnValue('customer:key'),
    getCustomerByEmail: vi.fn(),
}));

vi.mock('../handlers/admin.js', () => ({
    handleAdminGetMe: vi.fn().mockResolvedValue(new Response(JSON.stringify({ customer: {} }), { status: 200 })),
    handleUpdateMe: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleGetAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ analytics: {} }), { status: 200 })),
    handleGetRealtimeAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ realtime: {} }), { status: 200 })),
    handleGetErrorAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [] }), { status: 200 })),
    handleGetEmailAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ emails: [] }), { status: 200 })),
    handleGetOnboarding: vi.fn().mockResolvedValue(new Response(JSON.stringify({ onboarding: {} }), { status: 200 })),
    handleUpdateOnboarding: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleTestOTP: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleListUsers: vi.fn().mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 })),
    handleExportUserData: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })),
    handleDeleteUserData: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleGetAuditLogs: vi.fn().mockResolvedValue(new Response(JSON.stringify({ logs: [] }), { status: 200 })),
    handleGetConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ config: {} }), { status: 200 })),
    handleUpdateConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleUpdateEmailConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/domain.js', () => ({
    handleRequestDomainVerification: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleVerifyDomain: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/public.js', () => ({
    handleRegisterCustomer: vi.fn().mockResolvedValue(new Response(JSON.stringify({ customerId: 'cust_123' }), { status: 201 })),
}));

vi.mock('../handlers/admin/data-requests.js', () => ({
    handleCreateDataRequest: vi.fn().mockResolvedValue(new Response(JSON.stringify({ requestId: 'req_123' }), { status: 201 })),
    handleListDataRequests: vi.fn().mockResolvedValue(new Response(JSON.stringify({ requests: [] }), { status: 200 })),
    handleGetDataRequest: vi.fn().mockResolvedValue(new Response(JSON.stringify({ request: {} }), { status: 200 })),
    handleUpdateDataRequest: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleDeleteDataRequest: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('@strixun/api-framework', () => ({
    encryptWithJWT: vi.fn().mockImplementation(async (data) => data),
}));

describe('OTP Auth Service Admin Routes', () => {
    const mockEnv = {
        OTP_AUTH_KV: {} as any,
        SUPER_ADMIN_API_KEY: 'super-secret-key',
        SUPER_ADMIN_EMAILS: 'admin@example.com',
        JWT_SECRET: 'test-secret',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Unauthorized Access', () => {
        it('should reject GET /admin/customers/me without authentication', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(
                new Response(JSON.stringify({ error: 'Super-admin authentication required' }), { status: 401 })
            );

            const request = new Request('https://api.example.com/admin/customers/me', {
                method: 'GET',
            });

            const result = await handleAdminRoutes(request, '/admin/customers/me', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });

        it('should reject GET /admin/analytics without super admin', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(
                new Response(JSON.stringify({ error: 'Super-admin authentication required' }), { status: 401 })
            );

            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
            });

            const result = await handleAdminRoutes(request, '/admin/analytics', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });
    });

    describe('Authorized Access - Super Admin', () => {
        it('should allow POST /admin/customers with super admin API key', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null); // No error = authenticated

            const request = new Request('https://api.example.com/admin/customers', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer super-secret-key',
                },
                body: JSON.stringify({ email: 'test@example.com' }),
            });

            const result = await handleAdminRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(201);
        });

        it('should allow GET /admin/customers/me for super admin', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/customers/me', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/customers/me', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });

        it('should allow GET /admin/analytics for super admin', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/analytics', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });

        it('should allow GET /admin/users for super admin', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/users', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });

        it('should allow GET /admin/config for super admin', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/config', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/config', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });
    });

    describe('Route Matching', () => {
        it('should handle dynamic routes like /admin/domains/:domain/status', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/domains/example.com/status', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/domains/example.com/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });

        it('should handle /admin/users/:userId/export', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);

            const request = new Request('https://api.example.com/admin/users/user-123/export', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/users/user-123/export', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });
    });
});

