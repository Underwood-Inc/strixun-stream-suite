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
import type { AuthenticatedCustomer, AuthState, AuthStoreMethods, AuthStoreConfig } from '../core/types';
import { fetchCustomerInfo, getAuthApiUrl } from '../core/api';

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
                    // CRITICAL: Include credentials to send HttpOnly cookies
                    credentials: 'include' as RequestCredentials,
                });
                
                // Call logout endpoint - this clears the HttpOnly cookie
                await authClient.post('/auth/logout', {});
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
                
                // Not authenticated (401/403) - this is expected, not an error
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return false;
            } catch (error) {
                // Network errors, 500s, etc. are critical - log and rethrow for caller to handle
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('[Auth] Check auth failed with critical error:', errorMessage);
                
                // Set auth state to false but don't swallow the error
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                
                // Re-throw so caller can handle it (fail-fast)
                throw new Error(`Authentication check failed: ${errorMessage}. Check your connection and that the auth service is running.`);
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
