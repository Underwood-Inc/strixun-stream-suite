/**
 * Integration Tests for Mods API Admin Routes
 * 
 * Tests verify that all admin routes are properly protected:
 * - Unauthorized requests are rejected
 * - Authorized super admin requests are allowed
 * - All routes return appropriate responses
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAdminRoutes } from './admin-routes.js';

// Mock dependencies -- verifyJWT no longer exported from auth.js (RS256 only via extractAuth)

vi.mock('../handlers/admin/list.js', () => ({
    handleListAllMods: vi.fn().mockResolvedValue(new Response(JSON.stringify({ mods: [] }), { status: 200 })),
}));

vi.mock('../handlers/admin/triage.js', () => ({
    handleUpdateModStatus: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleAddReviewComment: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/admin/approvals.js', () => ({
    handleListApprovedUsers: vi.fn().mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 })),
    handleApproveUser: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleRevokeUser: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/admin/delete.js', () => ({
    handleAdminDeleteMod: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/admin/r2-management.js', () => ({
    handleListR2Files: vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 })),
    handleDetectDuplicates: vi.fn().mockResolvedValue(new Response(JSON.stringify({ duplicates: [] }), { status: 200 })),
    handleDeleteR2File: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

vi.mock('../handlers/admin/customers.js', () => ({
    handleListCustomers: vi.fn().mockResolvedValue(new Response(JSON.stringify({ customers: [] }), { status: 200 })),
    handleGetCustomerDetails: vi.fn().mockResolvedValue(new Response(JSON.stringify({ customer: {} }), { status: 200 })),
    handleUpdateCustomer: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
    handleGetCustomerMods: vi.fn().mockResolvedValue(new Response(JSON.stringify({ mods: [] }), { status: 200 })),
}));

vi.mock('../handlers/admin/settings.js', () => ({
    handleGetSettings: vi.fn().mockResolvedValue(new Response(JSON.stringify({ allowedFileExtensions: ['.lua'] }), { status: 200 })),
    handleUpdateSettings: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
}));

// Mock customer lookup
const mockFetchCustomerByCustomerId = vi.fn();
vi.mock('@strixun/customer-lookup', () => ({
    fetchCustomerByCustomerId: mockFetchCustomerByCustomerId,
}));

// Mock Access Service client
vi.mock('../../shared/access-client.js', () => ({
    createAccessClient: vi.fn(() => ({
        isSuperAdmin: vi.fn(async (customerId: string) => customerId === 'cust_123'),
        isAdmin: vi.fn(async (customerId: string) => customerId === 'cust_123'),
        checkPermission: vi.fn(async () => true),
        getCustomerAuthorization: vi.fn(async (customerId: string) => {
            if (customerId === 'cust_123') {
                return {
                    customerId: 'cust_123',
                    roles: ['super-admin', 'uploader'],
                    permissions: ['*'],
                    quotas: {},
                    metadata: { createdAt: '', updatedAt: '' },
                };
            }
            return null;
        }),
    })),
}));

vi.mock('@strixun/api-framework', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@strixun/api-framework')>();
    return {
        ...actual,
        wrapWithEncryption: vi.fn().mockImplementation(async (response, auth, request?, env?) => {
            return {
                response: response,
                customerId: auth?.customerId || null
            };
        }),
        protectAdminRoute: vi.fn().mockImplementation(async (request: Request) => {
            const authHeader = request.headers.get('Authorization');
            const cookieHeader = request.headers.get('Cookie');
            const token = authHeader?.startsWith('Bearer ')
                ? authHeader.substring(7)
                : cookieHeader?.includes('auth_token=')
                    ? cookieHeader.split(';').find((c: string) => c.trim().startsWith('auth_token='))?.split('=')[1]?.trim()
                    : null;
            if (!token) {
                return { allowed: false, error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
            }
            if (token === 'regular-token') {
                return { allowed: false, error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) };
            }
            return { allowed: true, auth: { customerId: 'cust_123', jwtToken: token } };
        }),
    };
});

describe('Mods API Admin Routes', () => {
    const mockEnv = {
        MODS_KV: {} as any,
        SUPER_ADMIN_EMAILS: 'admin@example.com',
        JWT_SECRET: 'test-secret',
        ALLOWED_ORIGINS: 'https://example.com',
    };

    const superAdminJWT = {
        sub: 'admin_123',
        customerId: 'cust_123',
        // email not in JWT - should be looked up from customer record
    };

    const regularUserJWT = {
        sub: 'user_123',
        customerId: 'cust_456',
        // email not in JWT - should be looked up from customer record
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchCustomerByCustomerId.mockClear();
        
        // Setup customer lookup mocks - customerId determines admin status via email lookup
        mockFetchCustomerByCustomerId.mockImplementation(async (customerId: string) => {
            if (customerId === 'cust_123') {
                return {
                    customerId: 'cust_123',
                    email: 'admin@example.com', // Super admin email (matches SUPER_ADMIN_EMAILS)
                    displayName: 'Admin User',
                };
            }
            if (customerId === 'cust_456') {
                return {
                    customerId: 'cust_456',
                    email: 'user@example.com', // Regular user email (not in SUPER_ADMIN_EMAILS)
                    displayName: 'Regular User',
                };
            }
            return null;
        });
    });

    describe('Unauthorized Access', () => {
        it('should reject GET /admin/mods without authentication', async () => {
            const request = new Request('https://api.example.com/admin/mods', {
                method: 'GET',
            });

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });

        it('should reject GET /admin/settings without authentication', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
            });

            const result = await handleAdminRoutes(request, '/admin/settings', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });

        it('should reject POST /admin/mods/:modId/status with regular user', async () => {
            const request = new Request('https://api.example.com/admin/mods/test-mod/status', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer regular-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(403);
        });
    });

    describe('Authorized Access - Super Admin', () => {
        it('should allow GET /admin/mods for super admin', async () => {
            const request = new Request('https://api.example.com/admin/mods', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow GET /admin/settings for super admin', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/settings', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow PUT /admin/settings for super admin', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ allowedFileExtensions: ['.lua', '.js'] }),
            });

            const result = await handleAdminRoutes(request, '/admin/settings', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow POST /admin/mods/:modId/status for super admin', async () => {
            const request = new Request('https://api.example.com/admin/mods/test-mod/status', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'approved' }),
            });

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow DELETE /admin/mods/:modId for super admin', async () => {
            const request = new Request('https://api.example.com/admin/mods/test-mod', {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow GET /admin/r2/files for super admin', async () => {
            const request = new Request('https://api.example.com/admin/r2/files', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/r2/files', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });

        it('should allow GET /admin/approvals for super admin', async () => {
            const request = new Request('https://api.example.com/admin/approvals', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/approvals', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });
    });

    describe('Route Matching', () => {
        it('should return null for unknown admin routes', async () => {
            const request = new Request('https://api.example.com/admin/unknown', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/unknown', mockEnv);

            expect(result).toBeNull();
        });

        it('should handle POST /admin/mods/:modId/comments', async () => {
            const request = new Request('https://api.example.com/admin/mods/test-mod/comments', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer admin-token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ comment: 'Test comment' }),
            });

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/comments', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Access Service checks admin status via customerId (no customer lookup needed)
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            const { handleListAllMods } = await import('../handlers/admin/list.js');
            (handleListAllMods as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('KV read failure'));

            const request = new Request('https://api.example.com/admin/mods', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(500);
        });
    });
});

