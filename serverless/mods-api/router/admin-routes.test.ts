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
import { verifyJWT } from '../utils/auth.js';

// Mock dependencies
vi.mock('../utils/auth.js', () => ({
    verifyJWT: vi.fn(),
}));

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
        protectAdminRoute: vi.fn().mockImplementation(async (request, env, level, verifyFn) => {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return { allowed: false, error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
            }
            const token = authHeader.substring(7);
            const payload = await verifyFn(token, env.JWT_SECRET);
            if (!payload) {
                return { allowed: false, error: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }) };
            }
            
            // Use customerId lookup flow: get customer by customerId, check email against SUPER_ADMIN_EMAILS
            const customerId = (payload as any).customerId;
            let isSuperAdmin = false;
            
            if (customerId) {
                const customer = await mockFetchCustomerByCustomerId(customerId, env);
                if (customer && customer.email) {
                    const superAdminEmails = env.SUPER_ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || [];
                    isSuperAdmin = superAdminEmails.includes(customer.email.toLowerCase());
                }
            }
            
            // Fallback to email check if customerId lookup fails
            if (!isSuperAdmin && (payload as any).email) {
                const email = (payload as any).email;
                const superAdminEmails = env.SUPER_ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || [];
                isSuperAdmin = superAdminEmails.includes(email.toLowerCase());
            }
            
            if (level === 'super-admin' && !isSuperAdmin) {
                return { allowed: false, error: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) };
            }
            return { allowed: true, auth: { userId: (payload as any).sub, email: (payload as any).email, customerId: customerId || null } };
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

            vi.mocked(verifyJWT).mockResolvedValue(null);

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(401);
        });

        it('should reject GET /admin/settings without authentication', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
            });

            vi.mocked(verifyJWT).mockResolvedValue(null);

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

            vi.mocked(verifyJWT).mockResolvedValue(regularUserJWT);

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(403);
            // Verify customer lookup was called
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_456', expect.any(Object));
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

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
        });

        it('should allow GET /admin/settings for super admin', async () => {
            const request = new Request('https://api.example.com/admin/settings', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/settings', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
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

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/settings', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
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

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/status', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
        });

        it('should allow DELETE /admin/mods/:modId for super admin', async () => {
            const request = new Request('https://api.example.com/admin/mods/test-mod', {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
        });

        it('should allow GET /admin/r2/files for super admin', async () => {
            const request = new Request('https://api.example.com/admin/r2/files', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/r2/files', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
        });

        it('should allow GET /admin/approvals for super admin', async () => {
            const request = new Request('https://api.example.com/admin/approvals', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/approvals', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
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

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

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

            vi.mocked(verifyJWT).mockResolvedValue(superAdminJWT);

            const result = await handleAdminRoutes(request, '/admin/mods/test-mod/comments', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(200);
            // Verify customer lookup was called to get email from customer record
            expect(mockFetchCustomerByCustomerId).toHaveBeenCalledWith('cust_123', expect.any(Object));
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            const request = new Request('https://api.example.com/admin/mods', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer admin-token',
                },
            });

            vi.mocked(verifyJWT).mockRejectedValue(new Error('JWT verification failed'));

            const result = await handleAdminRoutes(request, '/admin/mods', mockEnv);

            expect(result).not.toBeNull();
            expect(result?.response.status).toBe(500);
        });
    });
});

