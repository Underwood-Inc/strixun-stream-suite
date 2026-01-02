/**
 * Unit tests for Zustand auth store adapter
 * Tests customerId extraction from JWT in setUser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthStore } from './zustand.js';
import type { User } from '../core/types.js';

// Mock JWT creation helper (Node.js compatible)
function createMockJWT(payload: Record<string, any>): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = 'mock_signature';
    const encodedSignature = Buffer.from(signature).toString('base64url');
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

describe('Zustand Auth Store - setUser customerId extraction', () => {
    let store: ReturnType<typeof createAuthStore>;
    
    beforeEach(() => {
        // Create a fresh store for each test
        store = createAuthStore({
            authApiUrl: 'http://localhost:8787',
            storageKey: 'test-auth-storage',
            enableSessionRestore: false, // Disable for unit tests
            enableTokenValidation: false, // Disable for unit tests
        });
    });

    it('should extract customerId from JWT when setUser is called without customerId', () => {
        const customerId = 'cust_0ab4c4434c48';
        const userId = 'user_123';
        const email = 'test@example.com';
        
        // Create JWT with customerId
        const token = createMockJWT({
            sub: userId,
            email: email,
            customerId: customerId,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        });

        // Call setUser without customerId in user object
        const userWithoutCustomerId: User = {
            userId: userId,
            email: email,
            token: token,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };

        store.getState().setUser(userWithoutCustomerId);

        // Verify customerId was extracted from JWT
        const state = store.getState();
        expect(state.user).not.toBeNull();
        expect(state.user?.customerId).toBe(customerId);
        expect(state.user?.userId).toBe(userId);
        expect(state.user?.email).toBe(email);
    });

    it('should preserve existing customerId if already set in user object', () => {
        const existingCustomerId = 'cust_existing';
        const jwtCustomerId = 'cust_jwt';
        const userId = 'user_123';
        const email = 'test@example.com';
        
        // Create JWT with different customerId
        const token = createMockJWT({
            sub: userId,
            email: email,
            customerId: jwtCustomerId,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        });

        // Call setUser WITH customerId already set
        const userWithCustomerId: User = {
            userId: userId,
            email: email,
            token: token,
            customerId: existingCustomerId, // Already set
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };

        store.getState().setUser(userWithCustomerId);

        // Verify existing customerId is preserved (not overwritten by JWT)
        const state = store.getState();
        expect(state.user).not.toBeNull();
        expect(state.user?.customerId).toBe(existingCustomerId);
        expect(state.user?.customerId).not.toBe(jwtCustomerId);
    });

    it('should extract customerId from JWT even if user object has null customerId', () => {
        const customerId = 'cust_0ab4c4434c48';
        const userId = 'user_123';
        const email = 'test@example.com';
        
        // Create JWT with customerId
        const token = createMockJWT({
            sub: userId,
            email: email,
            customerId: customerId,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        });

        // Call setUser with explicit null customerId
        const userWithNullCustomerId: User = {
            userId: userId,
            email: email,
            token: token,
            customerId: null, // Explicitly null
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };

        store.getState().setUser(userWithNullCustomerId);

        // Verify customerId was extracted from JWT (null should be replaced)
        const state = store.getState();
        expect(state.user).not.toBeNull();
        expect(state.user?.customerId).toBe(customerId);
    });

    it('should handle JWT without customerId gracefully', () => {
        const userId = 'user_123';
        const email = 'test@example.com';
        
        // Create JWT WITHOUT customerId
        const token = createMockJWT({
            sub: userId,
            email: email,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        });

        // Call setUser without customerId
        const userWithoutCustomerId: User = {
            userId: userId,
            email: email,
            token: token,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };

        store.getState().setUser(userWithoutCustomerId);

        // Verify customerId remains null/undefined (not set)
        const state = store.getState();
        expect(state.user).not.toBeNull();
        expect(state.user?.customerId).toBeFalsy(); // Can be null or undefined
    });

    it('should also extract isSuperAdmin from JWT (existing behavior)', () => {
        const userId = 'user_123';
        const email = 'test@example.com';
        
        // Create JWT with isSuperAdmin
        const token = createMockJWT({
            sub: userId,
            email: email,
            isSuperAdmin: true,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        });

        const user: User = {
            userId: userId,
            email: email,
            token: token,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
        };

        store.getState().setUser(user);

        // Verify isSuperAdmin was extracted
        const state = store.getState();
        expect(state.user).not.toBeNull();
        expect(state.isSuperAdmin).toBe(true);
    });
});
