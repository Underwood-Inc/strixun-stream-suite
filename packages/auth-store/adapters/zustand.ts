/**
 * Zustand adapter for auth store
 * Use this in React projects
 *
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage token storage
 * - Cookies handle everything
 * - Proactive refresh: while tab is visible, refresh access token every 14 min (before 15 min expiry).
 */

import { create, type StateCreator } from 'zustand';
import type { AuthenticatedCustomer, AuthState, AuthStoreMethods, AuthStoreConfig } from '../core/types';
import { fetchCustomerInfo, getAuthApiUrl, refreshAuth } from '../core/api';

/** Access token TTL is 15 min; refresh 1 min before so the tab never sees 401. */
const PROACTIVE_REFRESH_MS = 14 * 60 * 1000;

interface ZustandAuthState extends AuthState, AuthStoreMethods {}

let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let visibilityListenerAttached = false;

function stopProactiveRefresh(): void {
    if (refreshTimerId !== null) {
        clearTimeout(refreshTimerId);
        refreshTimerId = null;
    }
}

function scheduleProactiveRefresh(
    get: () => ZustandAuthState,
    cfg?: AuthStoreConfig
): void {
    stopProactiveRefresh();
    if (typeof document === 'undefined' || document.visibilityState === 'hidden') return;
    refreshTimerId = setTimeout(async () => {
        refreshTimerId = null;
        if (document.visibilityState !== 'visible' || !get().isAuthenticated) return;
        const ok = await refreshAuth(cfg);
        if (ok && get().isAuthenticated) scheduleProactiveRefresh(get, cfg);
    }, PROACTIVE_REFRESH_MS);
}

function attachVisibilityListener(get: () => ZustandAuthState, cfg?: AuthStoreConfig): void {
    if (visibilityListenerAttached || typeof document === 'undefined') return;
    visibilityListenerAttached = true;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopProactiveRefresh();
        } else if (get().isAuthenticated) {
            scheduleProactiveRefresh(get, cfg);
        }
    });
}

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
                stopProactiveRefresh();
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
            attachVisibilityListener(get, config);
            scheduleProactiveRefresh(get, config);
        },
        
        logout: async () => {
            stopProactiveRefresh();
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
                let customerInfo = await fetchCustomerInfo(null, config);

                // If the access token expired (returned null), attempt a silent refresh
                if (!customerInfo) {
                    const refreshed = await refreshAuth(config);
                    if (refreshed) {
                        customerInfo = await fetchCustomerInfo(null, config);
                    }
                }

                if (customerInfo) {
                    const customer: AuthenticatedCustomer = {
                        customerId: customerInfo.customerId,
                        displayName: customerInfo.displayName,
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    };
                    set({ 
                        customer, 
                        isAuthenticated: true,
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    });
                    attachVisibilityListener(get, config);
                    scheduleProactiveRefresh(get, config);
                    return true;
                }
                
                // Not authenticated and refresh failed — session is truly over
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return false;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('[Auth] Check auth failed with critical error:', errorMessage);
                
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                
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
