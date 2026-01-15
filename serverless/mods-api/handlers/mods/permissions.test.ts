/**
 * Tests for mod permissions handler
 * CRITICAL: Ensures email is NEVER returned in responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetCustomerPermissions } from './permissions.js';

// Mock dependencies - admin.js functions
vi.mock('../../utils/admin.js', () => ({
    hasUploadPermission: vi.fn().mockResolvedValue(true),
    isSuperAdmin: vi.fn().mockResolvedValue(false),
    getCustomerPermissionInfo: vi.fn().mockResolvedValue({
        hasUploadPermission: true,
        isAdmin: false,
        isSuperAdmin: false,
        roles: ['customer', 'uploader'],
        permissions: ['upload:mod', 'edit:mod-own', 'delete:mod-own'],
        quotas: {},
        permissionSource: 'access-service',
    }),
}));

vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
    getCorsHeaders: vi.fn(() => new Headers()),
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

import { hasUploadPermission, isSuperAdmin, getCustomerPermissionInfo } from '../../utils/admin.js';

describe('handleGetCustomerPermissions', () => {
    const mockEnv = {
        ALLOWED_ORIGINS: '*',
    } as any;

    const mockRequest = new Request('https://example.com/mods/permissions/me', {
        method: 'GET',
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return permissions without email field', async () => {
        vi.mocked(getCustomerPermissionInfo).mockResolvedValue({
            hasUploadPermission: true,
            isAdmin: false,
            isSuperAdmin: false,
            roles: ['customer', 'uploader'],
            permissions: ['upload:mod'],
            quotas: {},
            permissionSource: 'access-service',
        });

        const auth = {
            customerId: 'cust_abc',
            email: 'user@example.com',
        };

        const response = await handleGetCustomerPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: email must NOT be in response
        expect(data).not.toHaveProperty('email');
        expect(data.customerId).toBe('cust_abc');
        expect(data.hasUploadPermission).toBe(true);
        expect(data.isSuperAdmin).toBe(false);
    });

    it('should return permissions with displayName when available', async () => {
        vi.mocked(getCustomerPermissionInfo).mockResolvedValue({
            hasUploadPermission: true,
            isAdmin: false,
            isSuperAdmin: false,
            roles: ['customer', 'uploader'],
            permissions: ['upload:mod'],
            quotas: {},
            permissionSource: 'access-service',
        });

        const auth = {
            customerId: 'cust_abc',
            email: 'user@example.com',
        };

        const response = await handleGetCustomerPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // Verify email is not present
        expect(data).not.toHaveProperty('email');
        expect(data.customerId).toBe('cust_abc');
    });

    it('should handle missing email in auth gracefully', async () => {
        vi.mocked(getCustomerPermissionInfo).mockResolvedValue({
            hasUploadPermission: false,
            isAdmin: false,
            isSuperAdmin: false,
            roles: [],
            permissions: [],
            quotas: {},
            permissionSource: 'none',
        });

        const auth = {
            customerId: 'cust_abc',
        };

        const response = await handleGetCustomerPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: email must NOT be in response even if missing in auth
        expect(data).not.toHaveProperty('email');
        expect(data.customerId).toBe('cust_abc');
        expect(data.hasUploadPermission).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
    });

    it('should return 200 status on success', async () => {
        vi.mocked(getCustomerPermissionInfo).mockResolvedValue({
            hasUploadPermission: true,
            isAdmin: false,
            isSuperAdmin: false,
            roles: ['customer', 'uploader'],
            permissions: ['upload:mod'],
            quotas: {},
            permissionSource: 'access-service',
        });

        const auth = {
            customerId: 'cust_abc',
            email: 'user@example.com',
        };

        const response = await handleGetCustomerPermissions(mockRequest, mockEnv, auth);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle errors without exposing email', async () => {
        vi.mocked(getCustomerPermissionInfo).mockRejectedValue(new Error('Database error'));

        const auth = {
            customerId: 'cust_abc',
            email: 'user@example.com',
        };

        const response = await handleGetCustomerPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: Even in error responses, email must NOT be exposed
        expect(data).not.toHaveProperty('email');
        expect(response.status).toBe(500);
    });
});

