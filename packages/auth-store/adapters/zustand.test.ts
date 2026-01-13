/**
 * Unit Tests for Zustand Auth Store Adapter
 * Tests the React/Zustand auth adapter with HttpOnly cookie-based SSO
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuthStore } from './zustand.js';
import type { AuthenticatedCustomer } from '../core/types.js';

// Mock API framework client
vi.mock('@strixun/api-framework/client', () => ({
    createAPIClient: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
    })),
}));

// Mock core API functions
vi.mock('../core/api.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        fetchCustomerInfo: vi.fn(),
        getAuthApiUrl: vi.fn(() => 'https://auth.idling.app'),
    };
});

describe('Zustand Auth Store Adapter', () => {
    let store: ReturnType<typeof createAuthStore>;
    
    beforeEach(() => {
        vi.clearAllMocks();
        store = createAuthStore();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            const state = store.getState();
            
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should have all required methods', () => {
            const state = store.getState();
            
            expect(typeof state.setCustomer).toBe('function');
            expect(typeof state.logout).toBe('function');
            expect(typeof state.checkAuth).toBe('function');
        });
    });

    describe('setCustomer', () => {
        it('should set customer and update authentication state', () => {
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                displayName: 'Test User',
                isSuperAdmin: false,
            };

            store.getState().setCustomer(customer);

            const state = store.getState();
            expect(state.customer).toEqual(customer);
            expect(state.isAuthenticated).toBe(true);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should set isSuperAdmin from customer object', () => {
            const adminCustomer: AuthenticatedCustomer = {
                customerId: 'cust_admin',
                email: 'admin@example.com',
                displayName: 'Admin User',
                isSuperAdmin: true,
            };

            store.getState().setCustomer(adminCustomer);

            const state = store.getState();
            expect(state.customer).toEqual(adminCustomer);
            expect(state.isAuthenticated).toBe(true);
            expect(state.isSuperAdmin).toBe(true);
        });

        it('should clear authentication when setting null customer', () => {
            // First set a customer
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };
            store.getState().setCustomer(customer);
            expect(store.getState().isAuthenticated).toBe(true);

            // Then clear it
            store.getState().setCustomer(null);

            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should handle customer without displayName', () => {
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };

            store.getState().setCustomer(customer);

            const state = store.getState();
            expect(state.customer).toEqual(customer);
            expect(state.isAuthenticated).toBe(true);
        });

        it('should default isSuperAdmin to false if not provided', () => {
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
            };

            store.getState().setCustomer(customer);

            const state = store.getState();
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should update customer when called multiple times', () => {
            const customer1: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                displayName: 'User One',
                isSuperAdmin: false,
            };

            const customer2: AuthenticatedCustomer = {
                customerId: 'cust_456',
                email: 'new@example.com',
                displayName: 'User Two',
                isSuperAdmin: true,
            };

            store.getState().setCustomer(customer1);
            expect(store.getState().customer?.customerId).toBe('cust_123');
            expect(store.getState().isSuperAdmin).toBe(false);

            store.getState().setCustomer(customer2);
            expect(store.getState().customer?.customerId).toBe('cust_456');
            expect(store.getState().isSuperAdmin).toBe(true);
        });
    });

    describe('logout', () => {
        it('should clear authentication state on logout', async () => {
            // First set a customer
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };
            store.getState().setCustomer(customer);
            expect(store.getState().isAuthenticated).toBe(true);

            // Then logout
            await store.getState().logout();

            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should handle logout when not authenticated', async () => {
            // Call logout when not authenticated
            await store.getState().logout();

            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
        });

        it('should clear authentication even if API call fails', async () => {
            // Mock API failure
            const { createAPIClient } = await import('@strixun/api-framework/client');
            const mockPost = vi.fn().mockRejectedValue(new Error('Network error'));
            vi.mocked(createAPIClient).mockReturnValue({
                post: mockPost,
                get: vi.fn(),
            } as any);

            // Set customer first
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };
            store.getState().setCustomer(customer);

            // Logout should clear state even with API failure
            await store.getState().logout();

            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });
    });

    describe('checkAuth', () => {
        it('should update auth state when customer info is available', async () => {
            // Mock successful customer info fetch
            const { fetchCustomerInfo } = await import('../core/api.js');
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                displayName: 'Test User',
                isSuperAdmin: false,
            });

            const result = await store.getState().checkAuth();

            expect(result).toBe(true);
            const state = store.getState();
            expect(state.customer).not.toBeNull();
            expect(state.customer?.customerId).toBe('cust_123');
            expect(state.customer?.displayName).toBe('Test User');
            expect(state.isAuthenticated).toBe(true);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should set isSuperAdmin from customer info', async () => {
            // Mock successful admin customer info fetch
            const { fetchCustomerInfo } = await import('../core/api.js');
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_admin',
                displayName: 'Admin User',
                isSuperAdmin: true,
            });

            const result = await store.getState().checkAuth();

            expect(result).toBe(true);
            const state = store.getState();
            expect(state.isSuperAdmin).toBe(true);
        });

        it('should clear auth state when customer info is not available', async () => {
            // First set authenticated state
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };
            store.getState().setCustomer(customer);

            // Mock no customer info available
            const { fetchCustomerInfo } = await import('../core/api.js');
            vi.mocked(fetchCustomerInfo).mockResolvedValue(null);

            const result = await store.getState().checkAuth();

            expect(result).toBe(false);
            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should clear auth state on fetch error', async () => {
            // First set authenticated state
            const customer: AuthenticatedCustomer = {
                customerId: 'cust_123',
                email: 'test@example.com',
                isSuperAdmin: false,
            };
            store.getState().setCustomer(customer);

            // Mock fetch error
            const { fetchCustomerInfo } = await import('../core/api.js');
            vi.mocked(fetchCustomerInfo).mockRejectedValue(new Error('Network error'));

            const result = await store.getState().checkAuth();

            expect(result).toBe(false);
            const state = store.getState();
            expect(state.customer).toBeNull();
            expect(state.isAuthenticated).toBe(false);
            expect(state.isSuperAdmin).toBe(false);
        });

        it('should handle customer info without displayName', async () => {
            // Mock customer info without displayName
            const { fetchCustomerInfo } = await import('../core/api.js');
            vi.mocked(fetchCustomerInfo).mockResolvedValue({
                customerId: 'cust_123',
                isSuperAdmin: false,
            });

            const result = await store.getState().checkAuth();

            expect(result).toBe(true);
            const state = store.getState();
            expect(state.customer?.customerId).toBe('cust_123');
            expect(state.customer?.displayName).toBeUndefined();
            expect(state.isAuthenticated).toBe(true);
        });
    });

    describe('Custom Config', () => {
        it('should use custom authApiUrl when provided', () => {
            const customStore = createAuthStore({
                authApiUrl: 'https://custom-auth.example.com',
            });

            expect(customStore).toBeDefined();
            expect(customStore.getState()).toBeDefined();
        });

        it('should work with default config', () => {
            const defaultStore = createAuthStore();

            expect(defaultStore).toBeDefined();
            expect(defaultStore.getState()).toBeDefined();
        });
    });
});
