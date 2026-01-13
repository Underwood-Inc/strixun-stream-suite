/**
 * Zustand adapter for auth store
 * Use this in React projects
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage token storage
 * - Cookies handle everything
 */

import { create, type StateCreator } from 'zustand';
import type { AuthenticatedCustomer, AuthState, AuthStoreMethods, AuthStoreConfig } from '../core/types.js';
import { fetchCustomerInfo, getAuthApiUrl } from '../core/api.js';

interface ZustandAuthState extends AuthState, AuthStoreMethods {}

/**
 * Create Zustand auth store
 */
export function createAuthStore(config?: AuthStoreConfig) {
    const authStoreCreator: StateCreator<ZustandAuthState> = (set, get) => ({
        customer: null,
        isAuthenticated: false,
        isSuperAdmin: false,
        
        setCustomer: (customer: AuthenticatedCustomer | null) => {
            if (!customer) {
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return;
            }
            
            set({ 
                customer, 
                isAuthenticated: true,
                isSuperAdmin: customer.isSuperAdmin || false,
            });
        },
        
        logout: async () => {
            try {
                const apiUrl = config?.authApiUrl || getAuthApiUrl(config);
                const { createAPIClient } = await import('@strixun/api-framework/client');
                const authClient = createAPIClient({
                    baseURL: apiUrl,
                    timeout: 5000,
                    // Cookie is sent automatically
                });
                
                // Call logout endpoint - this clears the HttpOnly cookie
                await authClient.post('/auth/logout', {}, {
                    credentials: 'include',
                });
            } catch (error) {
                console.warn('[Auth] Logout API call failed:', error);
            } finally {
                // Always clear local auth state
                set({ 
                    customer: null, 
                    isAuthenticated: false, 
                    isSuperAdmin: false,
                });
            }
        },
        
        checkAuth: async () => {
            try {
                const customerInfo = await fetchCustomerInfo(null, config);
                if (customerInfo) {
                    const customer: AuthenticatedCustomer = {
                        customerId: customerInfo.customerId,
                        email: '', // Not returned by /auth/me
                        displayName: customerInfo.displayName,
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    };
                    set({ 
                        customer, 
                        isAuthenticated: true,
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    });
                    return true;
                }
                
                // Not authenticated
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return false;
            } catch (error) {
                console.error('[Auth] Check auth failed:', error);
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return false;
            }
        },
        
        fetchCustomerInfo: async () => {
            try {
                const customerInfo = await fetchCustomerInfo(null, config);
                if (customerInfo) {
                    const currentCustomer = get().customer;
                    if (currentCustomer) {
                        const updatedCustomer: AuthenticatedCustomer = { 
                            ...currentCustomer, 
                            isSuperAdmin: customerInfo.isSuperAdmin, 
                            displayName: customerInfo.displayName || currentCustomer.displayName,
                            customerId: customerInfo.customerId,
                        };
                        set({ 
                            customer: updatedCustomer, 
                            isSuperAdmin: customerInfo.isSuperAdmin,
                        });
                    }
                }
            } catch (error) {
                console.warn('[Auth] Failed to fetch customer info:', error);
            }
        },
    });

    return create<ZustandAuthState>()(authStoreCreator);
}
