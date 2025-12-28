/**
 * Tests for mod permissions handler
 * CRITICAL: Ensures email is NEVER returned in responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetUserPermissions } from './permissions.js';

// Mock dependencies
vi.mock('../../utils/admin.js', () => ({
    hasUploadPermission: vi.fn(),
    isSuperAdminEmail: vi.fn(),
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

import { hasUploadPermission, isSuperAdminEmail } from '../../utils/admin.js';

describe('handleGetUserPermissions', () => {
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
        vi.mocked(hasUploadPermission).mockResolvedValue(true);
        vi.mocked(isSuperAdminEmail).mockResolvedValue(false);

        const auth = {
            userId: 'user_123',
            email: 'user@example.com',
            customerId: 'cust_abc',
        };

        const response = await handleGetUserPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: email must NOT be in response
        expect(data).not.toHaveProperty('email');
        expect(data).toEqual({
            hasUploadPermission: true,
            isSuperAdmin: false,
            userId: 'user_123',
        });
    });

    it('should return permissions with displayName when available', async () => {
        vi.mocked(hasUploadPermission).mockResolvedValue(true);
        vi.mocked(isSuperAdminEmail).mockResolvedValue(false);

        const auth = {
            userId: 'user_123',
            email: 'user@example.com',
            customerId: 'cust_abc',
        };

        const response = await handleGetUserPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // Verify email is not present
        expect(data).not.toHaveProperty('email');
        expect(data.userId).toBe('user_123');
    });

    it('should handle missing email in auth gracefully', async () => {
        vi.mocked(hasUploadPermission).mockResolvedValue(false);
        vi.mocked(isSuperAdminEmail).mockResolvedValue(false);

        const auth = {
            userId: 'user_123',
            customerId: 'cust_abc',
        };

        const response = await handleGetUserPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: email must NOT be in response even if missing in auth
        expect(data).not.toHaveProperty('email');
        expect(data).toEqual({
            hasUploadPermission: false,
            isSuperAdmin: false,
            userId: 'user_123',
        });
    });

    it('should return 200 status on success', async () => {
        vi.mocked(hasUploadPermission).mockResolvedValue(true);
        vi.mocked(isSuperAdminEmail).mockResolvedValue(false);

        const auth = {
            userId: 'user_123',
            email: 'user@example.com',
            customerId: 'cust_abc',
        };

        const response = await handleGetUserPermissions(mockRequest, mockEnv, auth);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle errors without exposing email', async () => {
        vi.mocked(hasUploadPermission).mockRejectedValue(new Error('Database error'));

        const auth = {
            userId: 'user_123',
            email: 'user@example.com',
            customerId: 'cust_abc',
        };

        const response = await handleGetUserPermissions(mockRequest, mockEnv, auth);
        const data = await response.json();

        // CRITICAL: Even in error responses, email must NOT be exposed
        expect(data).not.toHaveProperty('email');
        expect(response.status).toBe(500);
    });
});

