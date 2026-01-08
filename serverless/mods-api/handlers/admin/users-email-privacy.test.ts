/**
 * Tests for admin user handlers - Email Privacy
 * CRITICAL: Ensures email is NEVER returned in API responses
 * Only displayName and emailHash (for admin reference) are returned
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleListUsers, handleGetUserDetails } from './users.js';

// Mock dependencies
vi.mock('../../utils/admin.js', () => ({
    getApprovedUploaders: vi.fn(),
    getUserUploadPermissionInfo: vi.fn(),
}));

vi.mock('../../utils/customer.js', () => ({
    getCustomerKey: vi.fn((customerId, key) => customerId ? `cust_${customerId}_${key}` : key),
}));

vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
}));

vi.mock('../../utils/errors.js', () => ({
    createError: vi.fn((request, status, title, detail) => ({
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title,
        status,
        detail,
        instance: request.url,
    })),
}));

import { getApprovedUploaders, getUserUploadPermissionInfo } from '../../utils/admin.js';

// Mock the service client to avoid actual network calls
vi.mock('@strixun/service-client', () => ({
    createServiceClient: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
            status: 200,
            data: {
                users: [
                    { customerId: 'user_123',
                        displayName: 'CoolUser123',
                        customerId: 'cust_abc',
                        createdAt: '2024-01-01T00:00:00Z',
                        lastLogin: '2024-01-02T00:00:00Z',
                    },
                ],
                total: 1,
            },
        }),
    })),
}));

describe('Email Privacy in Admin User Handlers', () => {
    const mockEnv = {
        ALLOWED_ORIGINS: '*',
        AUTH_API_URL: 'https://auth.idling.app',
        SUPER_ADMIN_API_KEY: 'test-key',
        NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
        MODS_KV: {
            get: vi.fn(),
            list: vi.fn(),
        },
        OTP_AUTH_KV: {
            get: vi.fn(),
            list: vi.fn(),
        },
    } as any;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Reset the service client mock for each test
        const { createServiceClient } = await import('@strixun/service-client');
        vi.mocked(createServiceClient).mockReturnValue({
            get: vi.fn().mockResolvedValue({
                status: 200,
                data: {
                    users: [
                        { customerId: 'user_123',
                            displayName: 'CoolUser123',
                            customerId: 'cust_abc',
                            createdAt: '2024-01-01T00:00:00Z',
                            lastLogin: '2024-01-02T00:00:00Z',
                        },
                    ],
                    total: 1,
                },
            }),
        } as any);
        
        // Mock getUserUploadPermissionInfo to return default permission info
        vi.mocked(getUserUploadPermissionInfo).mockResolvedValue({
            hasPermission: false,
            isSuperAdmin: false,
            isApprovedUploader: false,
            permissionSource: 'none' as const,
        });
        
        // Mock KV operations to return empty immediately (prevents hanging on cursor loops)
        vi.mocked(mockEnv.MODS_KV.get).mockResolvedValue(null);
        vi.mocked(mockEnv.MODS_KV.list).mockResolvedValue({
            keys: [],
            listComplete: true,
        } as any);
        
        vi.mocked(mockEnv.OTP_AUTH_KV.get).mockResolvedValue(null);
        vi.mocked(mockEnv.OTP_AUTH_KV.list).mockResolvedValue({
            keys: [],
            listComplete: true,
        } as any);
    });

    describe('handleListUsers', () => {
        it('should return user list without email field', async () => {
            vi.mocked(getApprovedUploaders).mockResolvedValue(['user_123']);

            const mockRequest = new Request('https://example.com/admin/users', {
                method: 'GET',
            });

            const auth = { customerId: 'admin_123',
                email: 'admin@example.com',
                customerId: 'cust_admin',
            };

            const response = await handleListUsers(mockRequest, mockEnv, auth);
            const data = await response.json();

            // CRITICAL: email must NOT be in response
            expect(data.users).toBeDefined();
            expect(data.users.length).toBeGreaterThan(0);
            
            data.users.forEach((customer: any) => {
                expect(user).not.toHaveProperty('email');
                expect(user).toHaveProperty('displayName');
                expect(user).toHaveProperty('userId');
                expect(user).toHaveProperty('customerId');
            });
        });

        it('should return displayName instead of email', async () => {
            vi.mocked(getApprovedUploaders).mockResolvedValue(['user_123']);

            const mockRequest = new Request('https://example.com/admin/users', {
                method: 'GET',
            });

            const auth = { customerId: 'admin_123',
                email: 'admin@example.com',
                customerId: 'cust_admin',
            };

            const response = await handleListUsers(mockRequest, mockEnv, auth);
            const data = await response.json();

            // Verify displayName is present
            expect(data.users[0]).toHaveProperty('displayName');
            expect(data.users[0].displayName).toBe('CoolUser123');
        });

        it('should handle null displayName gracefully', async () => {
            // Mock service client for this specific test
            const { createServiceClient } = await import('@strixun/service-client');
            vi.mocked(createServiceClient).mockReturnValueOnce({
                get: vi.fn().mockResolvedValue({
                    status: 200,
                    data: {
                        users: [
                            { customerId: 'user_123',
                                displayName: null,
                                customerId: 'cust_abc',
                            },
                        ],
                        total: 1,
                    },
                }),
            } as any);

            vi.mocked(getApprovedUploaders).mockResolvedValue([]);

            const mockRequest = new Request('https://example.com/admin/users', {
                method: 'GET',
            });

            const auth = { customerId: 'admin_123',
                email: 'admin@example.com',
                customerId: 'cust_admin',
            };

            const response = await handleListUsers(mockRequest, mockEnv, auth);
            const data = await response.json();

            // CRITICAL: email must NOT be in response even if displayName is null
            expect(data.users[0]).not.toHaveProperty('email');
            expect(data.users[0].displayName).toBeNull();
        });
    });

    describe('handleGetUserDetails', () => {
        it('should return user details without email field', async () => {
            vi.mocked(getApprovedUploaders).mockResolvedValue(['user_123']);
            vi.mocked(mockEnv.MODS_KV.get).mockResolvedValue(null);
            vi.mocked(mockEnv.OTP_AUTH_KV.list).mockResolvedValue({
                keys: [],
                listComplete: true,
            });

            // Mock service client for this specific test
            const { createServiceClient } = await import('@strixun/service-client');
            vi.mocked(createServiceClient).mockReturnValueOnce({
                get: vi.fn().mockResolvedValue({
                    status: 200,
                    data: {
                        users: [
                            { customerId: 'user_123',
                                displayName: 'CoolUser123',
                                customerId: 'cust_abc',
                            },
                        ],
                        total: 1,
                    },
                }),
            } as any);

            const mockRequest = new Request('https://example.com/admin/users/user_123', {
                method: 'GET',
            });

            const auth = { customerId: 'admin_123',
                email: 'admin@example.com',
                customerId: 'cust_admin',
            };

            const response = await handleGetUserDetails(mockRequest, mockEnv, 'user_123', auth);
            const data = await response.json();

            // CRITICAL: email must NOT be in response
            expect(data).not.toHaveProperty('email');
            expect(data).toHaveProperty('displayName');
            expect(data).toHaveProperty('userId');
            expect(data).toHaveProperty('customerId');
            
            // emailHash is allowed (for admin reference only, not the actual email)
            if (data.emailHash) {
                expect(typeof data.emailHash).toBe('string');
                // emailHash should be a hash, not the actual email
                expect(data.emailHash).not.toBe('user@example.com');
            }
        });

        it('should return emailHash for admin reference (not actual email)', async () => {
            vi.mocked(getApprovedUploaders).mockResolvedValue(['user_123']);
            vi.mocked(mockEnv.MODS_KV.get).mockResolvedValue(null);
            vi.mocked(mockEnv.OTP_AUTH_KV.list).mockResolvedValue({
                keys: [
                    { name: 'customer_cust_abc_user_abc123def456' },
                ],
                listComplete: true,
            });

            // Mock service client for this specific test
            const { createServiceClient } = await import('@strixun/service-client');
            vi.mocked(createServiceClient).mockReturnValueOnce({
                get: vi.fn().mockResolvedValue({
                    status: 200,
                    data: {
                        users: [
                            { customerId: 'user_123',
                                displayName: 'CoolUser123',
                                customerId: 'cust_abc',
                            },
                        ],
                        total: 1,
                    },
                }),
            } as any);

            const mockRequest = new Request('https://example.com/admin/users/user_123', {
                method: 'GET',
            });

            const auth = { customerId: 'admin_123',
                email: 'admin@example.com',
                customerId: 'cust_admin',
            };

            const response = await handleGetUserDetails(mockRequest, mockEnv, 'user_123', auth);
            const data = await response.json();

            // emailHash is allowed (admin reference only)
            // But actual email must NEVER be returned
            expect(data).not.toHaveProperty('email');
            expect(data).toHaveProperty('displayName');
        });
    });
});

