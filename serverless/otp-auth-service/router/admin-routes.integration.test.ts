/**
 * Integration Tests for OTP Auth Service Dashboard Routes
 * 
 * Tests verify actual authentication flow and route protection:
 * - Real JWT verification and super-admin checking
 * - Real authentication logic (not mocked)
 * - Handler logic is still mocked (test handlers separately)
 * 
 * NOTE: These tests use real auth functions but mock external dependencies (KV, handlers).
 * This tests the actual authentication flow through the router.
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDashboardRoutes } from './dashboard-routes.js';
import { createJWT } from '../utils/crypto.js';

// Only mock external dependencies (KV, handlers), NOT auth functions
vi.mock('../services/customer.js', () => ({
    getCustomer: vi.fn(),
    storeCustomer: vi.fn(),
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
    // handleListCustomers removed - moved to customer-api
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

describe('OTP Auth Service Admin Routes - Integration Tests', () => {
    // SECURITY NOTE: All credentials below are TEST-ONLY values used exclusively in test files.
    // These are NOT production credentials and cannot be used to access real systems.
    // Production secrets are configured via Cloudflare Workers secrets (wrangler secret put).
    // - 'super-secret-key' is a test-only API key
    // - 'admin@example.com' uses example.com (reserved domain for examples)
    // - 'test-jwt-secret-for-integration-tests' is a test-only JWT secret
    // - OTP_AUTH_KV is mocked (no real database access)
    const mockEnv = {
        OTP_AUTH_KV: {
            get: vi.fn().mockResolvedValue(null), // Token not blacklisted
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            list: vi.fn().mockResolvedValue({ keys: [], listComplete: true }),
        } as any,
        SUPER_ADMIN_API_KEY: 'super-secret-key', // TEST-ONLY: Not a real production key
        SUPER_ADMIN_EMAILS: 'admin@example.com,superadmin@example.com', // TEST-ONLY: example.com is reserved for examples
        JWT_SECRET: 'test-jwt-secret-for-integration-tests', // TEST-ONLY: Not a real production secret
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset KV mock for each test
        mockEnv.OTP_AUTH_KV.get = vi.fn().mockResolvedValue(null); // Token not blacklisted
        mockEnv.OTP_AUTH_KV.put = vi.fn().mockResolvedValue(undefined);
        mockEnv.OTP_AUTH_KV.delete = vi.fn().mockResolvedValue(undefined);
        mockEnv.OTP_AUTH_KV.list = vi.fn().mockResolvedValue({ keys: [], listComplete: true });
    });

    describe('Super Admin API Key Authentication', () => {
        it('should authenticate with SUPER_ADMIN_API_KEY and allow POST /admin/customers', async () => {
            // Super admin routes use X-Super-Admin-Key header for API key authentication
            const request = new Request('https://api.example.com/admin/customers', {
                method: 'POST',
                headers: {
                    'X-Super-Admin-Key': 'super-secret-key',
                },
                body: JSON.stringify({ email: 'test@example.com' }),
            });

            const result = await handleDashboardRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(201);
        });

        it('should reject POST /admin/customers with invalid API key', async () => {
            // Super admin routes use X-Super-Admin-Key header for API key authentication
            const request = new Request('https://api.example.com/admin/customers', {
                method: 'POST',
                headers: {
                    'X-Super-Admin-Key': 'wrong-key',
                },
                body: JSON.stringify({ email: 'test@example.com' }),
            });

            const result = await handleDashboardRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
            const body = await result?.response.json();
            expect(body.error).toBe('Super-admin authentication required');
        });

        it('should reject POST /admin/customers without Authorization header', async () => {
            const request = new Request('https://api.example.com/admin/customers', {
                method: 'POST',
                body: JSON.stringify({ email: 'test@example.com' }),
            });

            const result = await handleDashboardRoutes(request, '/admin/customers', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });
    });


    describe('Authentication Flow Integration', () => {
        it('should authenticate with JWT and allow GET /admin/analytics for any authenticated user', async () => {
            // Create a valid JWT token for any user (analytics are customer-scoped)
            const jwtToken = await createJWT({
                email: 'admin@example.com',
                customerId: 'cust_123',
                exp: Math.floor(Date.now() / 1000) + 3600,
            }, mockEnv.JWT_SECRET!);

            // Dashboard routes use HttpOnly cookies, not Authorization header
            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
                headers: {
                    'Cookie': `auth_token=${jwtToken}`,
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/analytics', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });

        it('should allow regular users to access their own analytics (customer-scoped)', async () => {
            // Create a valid JWT token for a regular user (not super admin)
            // Analytics are filtered by customerId, so regular users see only their own data
            const jwtToken = await createJWT({
                email: 'regularuser@example.com',
                customerId: 'cust_456',
                exp: Math.floor(Date.now() / 1000) + 3600,
            }, mockEnv.JWT_SECRET!);

            // Dashboard routes use HttpOnly cookies, not Authorization header
            const request = new Request('https://api.example.com/admin/analytics', {
                method: 'GET',
                headers: {
                    'Cookie': `auth_token=${jwtToken}`,
                },
            });

            const result = await handleDashboardRoutes(request, '/admin/analytics', mockEnv);

            // Should succeed - analytics are customer-scoped, so regular users can access their own
            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
        });
    });
});

