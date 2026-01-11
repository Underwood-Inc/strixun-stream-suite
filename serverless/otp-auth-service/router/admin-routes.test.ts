/**
 * Unit Tests for OTP Auth Service Dashboard Routes
 * 
 * Tests verify route matching and handler invocation:
 * - Routes match correct paths and methods
 * - Unauthorized requests are rejected
 * - Authorized requests invoke correct handlers
 * 
 * NOTE: These are unit tests that mock handlers and auth functions.
 * For integration testing of actual authentication/handler logic, see handler-specific tests.
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDashboardRoutes } from './dashboard-routes.js';

// Mock dependencies
vi.mock('../utils/super-admin.js', () => ({
    requireSuperAdmin: vi.fn(),
    verifySuperAdmin: vi.fn(),
    isAdminOrSuperAdmin: vi.fn().mockResolvedValue(true), // Added for admin/super-admin checks
}));

vi.mock('../utils/crypto.js', () => ({
    verifyJWT: vi.fn(),
    getJWTSecret: vi.fn().mockReturnValue('test-secret'),
    hashEmail: vi.fn().mockResolvedValue('hashed-token'),
    hashApiKey: vi.fn().mockResolvedValue('hashed-api-key'),
}));

vi.mock('../services/customer.js', () => ({
    getCustomerKey: vi.fn().mockReturnValue('customer:key'),
    getCustomerByEmail: vi.fn(),
}));

vi.mock('../services/api-key.js', () => ({
    verifyApiKey: vi.fn().mockResolvedValue(null), // Return null to indicate no API key auth
}));

vi.mock('../handlers/admin.js', () => ({
    handleGetAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ analytics: {} }), { status: 200 })),
    handleGetRealtimeAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ realtime: {} }), { status: 200 })),
    handleGetErrorAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [] }), { status: 200 })),
    handleGetEmailAnalytics: vi.fn().mockResolvedValue(new Response(JSON.stringify({ emails: [] }), { status: 200 })),
    handleGetOnboarding: vi.fn().mockResolvedValue(new Response(JSON.stringify({ onboarding: {} }), { status: 200 })),
    handleUpdateOnboarding: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleTestOTP: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleListCustomers: vi.fn().mockResolvedValue(new Response(JSON.stringify({ customers: [] }), { status: 200 })),
    handleExportCustomerData: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })),
    handleDeleteCustomerData: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleGetAuditLogs: vi.fn().mockResolvedValue(new Response(JSON.stringify({ logs: [] }), { status: 200 })),
    handleGetConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ config: {} }), { status: 200 })),
    handleUpdateConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleUpdateEmailConfig: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/domain.js', () => ({
    handleRequestDomainVerification: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleVerifyDomain: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleGetDomainStatus: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'verified' }), { status: 200 })),
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

vi.mock('@strixun/api-framework', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@strixun/api-framework')>();
    return {
        ...actual,
        encryptWithJWT: vi.fn().mockImplementation(async (data) => data),
        wrapWithEncryption: vi.fn().mockImplementation(async (response, auth, request?, env?) => {
            return {
                response: response,
                customerId: auth?.customerId || null
            };
        }),
    };
});

vi.mock('../handlers/auth/customer-creation.js', () => ({
    ensureCustomerAccount: vi.fn().mockResolvedValue('cust_123'),
}));

describe('OTP Auth Service Admin Routes', () => {
    // SECURITY NOTE: All credentials below are TEST-ONLY values used exclusively in test files.
    // These are NOT production credentials and cannot be used to access real systems.
    // Production secrets are configured via Cloudflare Workers secrets (wrangler secret put).
    // - 'super-secret-key' is a test-only API key
    // - 'admin@example.com' uses example.com (reserved domain for examples)
    // - 'test-secret' is a test-only JWT secret
    // - OTP_AUTH_KV is mocked (no real database access)
    const mockEnv = {
        OTP_AUTH_KV: {
            get: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            list: vi.fn().mockResolvedValue({ keys: [], listComplete: true }),
        } as any,
        SUPER_ADMIN_API_KEY: 'super-secret-key', // TEST-ONLY: Not a real production key
        SUPER_ADMIN_EMAILS: 'admin@example.com', // TEST-ONLY: example.com is reserved for examples
        JWT_SECRET: 'test-secret', // TEST-ONLY: Not a real production secret
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset KV mock for each test
        mockEnv.OTP_AUTH_KV.get = vi.fn().mockResolvedValue(null);
        mockEnv.OTP_AUTH_KV.put = vi.fn().mockResolvedValue(undefined);
        mockEnv.OTP_AUTH_KV.delete = vi.fn().mockResolvedValue(undefined);
        mockEnv.OTP_AUTH_KV.list = vi.fn().mockResolvedValue({ keys: [], listComplete: true });
    });

    describe('Unauthorized Access', () => {
        it('should return 410 Gone for deprecated GET /admin/customers/me', async () => {
            const request = new Request('https://api.example.com/admin/customers/me', {
                method: 'GET',
            });

            const result = await handleDashboardRoutes(request, '/admin/customers/me', mockEnv);

            expect(result).not.toBeNull();
            // wrapWithEncryption returns { response: Response, customerId }, and router wraps it again
            // So result.response is the RouteResult from wrapWithEncryption
            const routeResult = result?.response;
            expect(routeResult).toBeDefined();
            // The actual Response is in routeResult.response
            const response = routeResult?.response || (routeResult as any);
            expect(response).toBeDefined();
            expect(response?.status).toBe(410);
            const body = await response?.json();
            expect(body.status).toBe(410);
            expect(body.title).toBe('Gone');
        });

        it('should reject GET /admin/analytics without authentication', async () => {
            // Analytics endpoint requires regular authentication (customer-scoped)
            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
            });

            const result = await handleDashboardRoutes(request, '/admin/analytics', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });
    });

    describe('Route Matching - Unit Tests (Mocks Only)', () => {
        it('should match POST /admin/customers route and invoke handler when super admin check passes', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            const { handleRegisterCustomer } = await import('../handlers/public.js');
            
            vi.mocked(requireSuperAdmin).mockResolvedValue(null); // No error = authenticated

            const request = new Request('https://api.example.com/admin/customers', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer super-secret-key',
                },
                body: JSON.stringify({ email: 'test@example.com' }),
            });

            const result = await handleDashboardRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(201);
            // Verify the correct handler was called
            expect(handleRegisterCustomer).toHaveBeenCalledWith(request, mockEnv);
        });


        it('should match GET /admin/analytics route and invoke handler when authenticated', async () => {
            const { verifyJWT } = await import('../utils/crypto.js');
            const { handleGetAnalytics } = await import('../handlers/admin.js');
            
            // Analytics endpoint only requires regular authentication (customer-scoped)
            vi.mocked(verifyJWT).mockResolvedValue({ 
                customerId: 'cust_123', 
                email: 'admin@example.com' 
            } as any);

            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/analytics', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify the correct handler was called with customerId (customer-scoped)
            expect(handleGetAnalytics).toHaveBeenCalledWith(request, mockEnv, 'cust_123');
        });

        it('should match GET /admin/customers route and invoke handler when authenticated', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            const { verifyJWT } = await import('../utils/crypto.js');
            const { handleListCustomers } = await import('../handlers/admin.js');
            
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);
            vi.mocked(verifyJWT).mockResolvedValue({ 
                customerId: 'cust_123', 
                email: 'admin@example.com' 
            } as any);

            const request = new Request('https://api.example.com/admin/customers', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify the correct handler was called
            expect(handleListCustomers).toHaveBeenCalledWith(request, mockEnv, 'cust_123');
        });

        it('should match GET /admin/config route and invoke handler when authenticated', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            const { verifyJWT } = await import('../utils/crypto.js');
            const { handleGetConfig } = await import('../handlers/admin.js');
            
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);
            vi.mocked(verifyJWT).mockResolvedValue({ 
                customerId: 'cust_123', 
                email: 'admin@example.com' 
            } as any);

            const request = new Request('https://api.example.com/admin/config', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/config', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify the correct handler was called
            expect(handleGetConfig).toHaveBeenCalledWith(request, mockEnv, 'cust_123');
        });

        it('should match dynamic route /admin/domains/:domain/status and invoke handler when authenticated', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            const { verifyJWT } = await import('../utils/crypto.js');
            const { handleGetDomainStatus } = await import('../handlers/domain.js');
            
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);
            vi.mocked(verifyJWT).mockResolvedValue({ 
                customerId: 'cust_123', 
                email: 'admin@example.com' 
            } as any);

            const request = new Request('https://api.example.com/admin/domains/example.com/status', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/domains/example.com/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify the correct handler was called with domain parameter
            // Note: handleGetDomainStatus is called with (request, env, domain) - no customerId
            expect(handleGetDomainStatus).toHaveBeenCalledWith(request, mockEnv, 'example.com');
        });

        it('should match dynamic route /admin/customers/:customerId/export and invoke handler when authenticated', async () => {
            const { requireSuperAdmin } = await import('../utils/super-admin.js');
            const { verifyJWT } = await import('../utils/crypto.js');
            const { handleExportCustomerData } = await import('../handlers/admin.js');
            
            vi.mocked(requireSuperAdmin).mockResolvedValue(null);
            vi.mocked(verifyJWT).mockResolvedValue({ 
                customerId: 'cust_123', 
                email: 'admin@example.com' 
            } as any);

            const request = new Request('https://api.example.com/admin/customers/customer-123/export', {
                method: 'POST', // Fixed: Route expects POST, not GET
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/customers/customer-123/export', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify the correct handler was called with customerId parameter
            // Note: handleExportCustomerData is called with (request, env, customerId, targetCustomerId)
            expect(handleExportCustomerData).toHaveBeenCalledWith(request, mockEnv, 'cust_123', 'customer-123');
        });
    });
});

