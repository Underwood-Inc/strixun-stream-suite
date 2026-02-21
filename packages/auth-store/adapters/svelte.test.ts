/**
 * Unit Tests for Auth Store Svelte Adapter
 * Tests HttpOnly cookie-based SSO functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { AuthenticatedCustomer } from '../core/types.js';

// Mock modules BEFORE importing
vi.mock('../core/api.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../core/api.js')>();
    return {
        ...original,
        fetchCustomerInfo: vi.fn(),
        refreshAuth: vi.fn().mockResolvedValue(false),
        decodeJWTPayload: vi.fn((token: string) => {
        // Simple mock decoder for testing
        if (token === 'valid_jwt_token') {
            return {
                customerId: 'cust_123',
                sub: 'cust_123',
                email: 'test@example.com',
                displayName: 'Test User',
                isSuperAdmin: true,
                csrf: 'csrf_token_abc',
                exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
            };
        }
        if (token === 'regular_user_token') {
            return {
                customerId: 'cust_456',
                sub: 'cust_456',
                email: 'regular@example.com',
                displayName: 'Regular User',
                isSuperAdmin: false,
                exp: Math.floor(Date.now() / 1000) + 3600,
            };
        }
        return null;
    }),
    };
});

vi.mock('../core/utils.js', () => ({
    getCookie: vi.fn(),
    deleteCookie: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

// NOW import after mocks are set up
import { createAuthStore } from './svelte.js';
import { getCookie, deleteCookie } from '../core/utils.js';
import { fetchCustomerInfo, refreshAuth } from '../core/api.js';
import { fetchCustomerInfo } from '../core/api.js';

describe('Auth Store - Svelte Adapter (HttpOnly Cookie SSO)', () => {
    let authStore: ReturnType<typeof createAuthStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset mock implementations
        vi.mocked(getCookie).mockReturnValue(null);
        vi.mocked(deleteCookie).mockReturnValue(undefined);
        vi.mocked(fetchCustomerInfo).mockResolvedValue(null);
        (global.fetch as any).mockReset();
        
        // Create fresh store for each test
        authStore = createAuthStore({
            authApiUrl: 'https://auth.idling.app',
        });
    });

    describe('Initial State', () => {
        it('should initialize with unauthenticated state', () => {
            expect(get(authStore.isAuthenticated)).toBe(false);
            expect(get(authStore.customer)).toBeNull();
            expect(get(authStore.isSuperAdmin)).toBe(false);
            expect(get(authStore.csrfToken)).toBeNull();
        });

        it('should have isTokenExpired as true when no customer', () => {
            expect(get(authStore.isTokenExpired)).toBe(true);
        });
    });

    describe('login()', () => {
        it('should update store with JWT payload', () => {
            authStore.login('valid_jwt_token');
            
            const customer = get(authStore.customer);
            expect(customer).toBeDefined();
            expect(customer?.customerId).toBe('cust_123');
            expect(customer?.displayName).toBe('Test User');
            expect(customer?.isSuperAdmin).toBe(true);
            expect(get(authStore.isAuthenticated)).toBe(true);
            expect(get(authStore.isSuperAdmin)).toBe(true);
        });

        it('should extract CSRF token from JWT', () => {
            authStore.login('valid_jwt_token');
            
            expect(get(authStore.csrfToken)).toBe('csrf_token_abc');
        });

        it('should handle JWT without isSuperAdmin', () => {
            authStore.login('regular_user_token');
            
            const customer = get(authStore.customer);
            expect(customer?.isSuperAdmin).toBe(false);
            expect(get(authStore.isSuperAdmin)).toBe(false);
        });

        it('should not update store with invalid JWT', () => {
            authStore.login('invalid_token');
            
            expect(get(authStore.customer)).toBeNull();
            expect(get(authStore.isAuthenticated)).toBe(false);
        });

        it('should calculate correct expiresAt from exp claim', () => {
            authStore.login('valid_jwt_token');
            
            const customer = get(authStore.customer);
            expect(customer?.expiresAt).toBeDefined();
            
            // Should be a valid ISO date string
            const expiresAt = new Date(customer!.expiresAt);
            expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('checkAuth()', () => {
        it('should return false when no cookie', async () => {
            vi.mocked(getCookie).mockReturnValue(null);
            
            const result = await authStore.checkAuth();
            
            expect(result).toBe(false);
            expect(get(authStore.isAuthenticated)).toBe(false);
        });

        it('should fetch customer info when cookie exists', async () => {
            vi.mocked(getCookie).mockReturnValue('valid_jwt_token');
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                displayName: 'Test User',
                isSuperAdmin: true,
            });
            
            const result = await authStore.checkAuth();
            
            expect(result).toBe(true);
            expect(fetchCustomerInfo).toHaveBeenCalled();
        });

        it('should update store with customer data on success', async () => {
            vi.mocked(getCookie).mockReturnValue('valid_jwt_token');
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                displayName: 'Test User',
                isSuperAdmin: true,
            });
            
            await authStore.checkAuth();
            
            const customer = get(authStore.customer);
            expect(customer?.customerId).toBe('cust_123');
            expect(customer?.displayName).toBe('Test User');
            expect(get(authStore.isAuthenticated)).toBe(true);
            expect(get(authStore.isSuperAdmin)).toBe(true);
        });

        it('should clear cookie and state when token invalid', async () => {
            vi.mocked(fetchCustomerInfo).mockResolvedValue(null);
            vi.mocked(refreshAuth).mockResolvedValue(false);
            
            const result = await authStore.checkAuth();
            
            expect(result).toBe(false);
            expect(get(authStore.isAuthenticated)).toBe(false);
        });

        it('should handle fetch errors gracefully', async () => {
            vi.mocked(fetchCustomerInfo).mockRejectedValue(new Error('Network error'));
            
            await expect(authStore.checkAuth()).rejects.toThrow('Authentication check failed');
            expect(get(authStore.isAuthenticated)).toBe(false);
        });
    });

    describe('logout()', () => {
        beforeEach(() => {
            // Set up authenticated state
            authStore.login('valid_jwt_token');
        });

        it('should call /auth/logout endpoint', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
            });
            
            await authStore.logout();
            
            expect(global.fetch).toHaveBeenCalledWith(
                'https://auth.idling.app/auth/logout',
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
        });

        it('should clear local state even if API call fails', async () => {
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
            
            await authStore.logout();
            
            expect(get(authStore.isAuthenticated)).toBe(false);
            expect(get(authStore.customer)).toBeNull();
            expect(get(authStore.isSuperAdmin)).toBe(false);
        });

        it('should delete cookie client-side', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
            });
            
            await authStore.logout();
            
            expect(deleteCookie).toHaveBeenCalledWith('auth_token', '.idling.app', '/');
        });

        it('should clear CSRF token', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                status: 200,
            });
            
            await authStore.logout();
            
            expect(get(authStore.csrfToken)).toBeNull();
        });
    });

    describe('getAuthToken()', () => {
        it('should return null (HttpOnly cookie not readable by JS)', () => {
            const token = authStore.getAuthToken();
            expect(token).toBeNull();
        });

        it('should return null when not authenticated', () => {
            authStore.setCustomer(null);
            const token = authStore.getAuthToken();
            expect(token).toBeNull();
        });
    });

    describe('getCsrfToken()', () => {
        it('should return null when not authenticated', () => {
            const csrf = authStore.getCsrfToken();
            expect(csrf).toBeNull();
        });

        it('should return CSRF token after login', () => {
            authStore.login('valid_jwt_token');
            
            const csrf = authStore.getCsrfToken();
            expect(csrf).toBe('csrf_token_abc');
        });
    });

    describe('setCustomer()', () => {
        it('should update customer state', () => {
            const customerData: AuthenticatedCustomer = {
                customerId: 'cust_789',
                email: 'custom@example.com',
                displayName: 'Custom User',
                token: 'custom_token',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                isSuperAdmin: false,
            };
            
            authStore.setCustomer(customerData);
            
            const customer = get(authStore.customer);
            expect(customer?.customerId).toBe('cust_789');
            expect(get(authStore.isAuthenticated)).toBe(true);
        });

        it('should clear state when set to null', () => {
            authStore.login('valid_jwt_token');
            
            authStore.setCustomer(null);
            
            expect(get(authStore.customer)).toBeNull();
            expect(get(authStore.isAuthenticated)).toBe(false);
        });
    });

    describe('fetchCustomerInfo()', () => {
        beforeEach(() => {
            authStore.login('valid_jwt_token');
        });

        it('should update customer with latest info', async () => {
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                displayName: 'Updated Name',
                isSuperAdmin: false,
            });
            
            await authStore.fetchCustomerInfo();
            
            const customer = get(authStore.customer);
            expect(customer?.displayName).toBe('Updated Name');
            expect(get(authStore.isSuperAdmin)).toBe(false);
        });

        it('should not clear state if fetch fails', async () => {
            vi.mocked(fetchCustomerInfo).mockRejectedValue(new Error('Network error'));
            
            await authStore.fetchCustomerInfo();
            
            // State should remain unchanged
            expect(get(authStore.isAuthenticated)).toBe(true);
            expect(get(authStore.customer)).not.toBeNull();
        });

        it('should not update if no customer in store', async () => {
            authStore.setCustomer(null);
            
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                displayName: 'Test',
                isSuperAdmin: false,
            });
            
            await authStore.fetchCustomerInfo();
            
            // Should not set customer (no initial customer)
            expect(get(authStore.customer)).toBeNull();
        });
    });

    describe('loadAuthState()', () => {
        it('should clear state when checkAuth fails', async () => {
            vi.mocked(fetchCustomerInfo).mockResolvedValue(null);
            vi.mocked(refreshAuth).mockResolvedValue(false);
            
            await authStore.loadAuthState();
            
            expect(get(authStore.isAuthenticated)).toBe(false);
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(getCookie).mockImplementation(() => {
                throw new Error('Cookie error');
            });
            
            await authStore.loadAuthState();
            
            // Should not throw, just clear state
            expect(get(authStore.isAuthenticated)).toBe(false);
        });
    });

    describe('Reactive Stores', () => {
        it('should update isTokenExpired when customer expires', () => {
            const expiredCustomer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                displayName: 'Test',
                token: 'token',
                expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
                isSuperAdmin: false,
            };
            
            authStore.setCustomer(expiredCustomer);
            
            expect(get(authStore.isTokenExpired)).toBe(true);
        });

        it('should update isTokenExpired when customer is valid', () => {
            const validCustomer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                displayName: 'Test',
                token: 'token',
                expiresAt: new Date(Date.now() + 3600000).toISOString(), // Valid
                isSuperAdmin: false,
            };
            
            authStore.setCustomer(validCustomer);
            
            expect(get(authStore.isTokenExpired)).toBe(false);
        });
    });
});
