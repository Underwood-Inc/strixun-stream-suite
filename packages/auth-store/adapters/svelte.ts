/**
 * Svelte adapter for auth store - HttpOnly Cookie SSO
 * Use this in Svelte projects
 *
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists
 * CRITICAL: Tokens are stored in HttpOnly cookies, NOT localStorage
 * Proactive refresh: while tab is visible, refresh access token every 14 min (same as Zustand).
 */

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { AuthenticatedCustomer, AuthStoreConfig } from '../core/types';
import { fetchCustomerInfo, decodeJWTPayload, refreshAuth } from '../core/api';
import { deleteCookie } from '../core/utils';

const PROACTIVE_REFRESH_MS = 14 * 60 * 1000;

let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let visibilityListenerAttached = false;

function stopProactiveRefresh(): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

function scheduleProactiveRefresh(
  getIsAuthenticated: () => boolean,
  cfg?: AuthStoreConfig
): void {
  stopProactiveRefresh();
  if (typeof document === 'undefined' || document.visibilityState === 'hidden') return;
  refreshTimerId = setTimeout(async () => {
    refreshTimerId = null;
    if (document.visibilityState !== 'visible' || !getIsAuthenticated()) return;
    const ok = await refreshAuth(cfg);
    if (ok && getIsAuthenticated()) scheduleProactiveRefresh(getIsAuthenticated, cfg);
  }, PROACTIVE_REFRESH_MS);
}

function attachVisibilityListener(getIsAuthenticated: () => boolean, cfg?: AuthStoreConfig): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopProactiveRefresh();
    } else if (getIsAuthenticated()) {
      scheduleProactiveRefresh(getIsAuthenticated, cfg);
    }
  });
}

/**
 * Create Svelte auth stores with HttpOnly cookie SSO
 */
export function createAuthStore(config?: AuthStoreConfig) {
    // Core stores
    const customer: Writable<AuthenticatedCustomer | null> = writable(null);
    const isAuthenticated: Writable<boolean> = writable(false);
    const isSuperAdmin: Writable<boolean> = writable(false);
    const csrfToken: Writable<string | null> = writable(null);
    // NOTE: No token store - token is in HttpOnly cookie and CANNOT be read by JavaScript
    
    // Derived stores
    const isTokenExpired: Readable<boolean> = derived(
        customer,
        ($customer) => {
            if (!$customer || !$customer.expiresAt) return true;
            return new Date($customer.expiresAt) < new Date();
        }
    );
    
    /**
     * Save authentication state - DO NOT persist token
     * Token is in HttpOnly cookie
     */
    function saveAuthState(customerData: AuthenticatedCustomer | null): void {
        if (customerData) {
            // Extract CSRF token and isSuperAdmin from JWT payload
            const payload = decodeJWTPayload(customerData.token || '');
            const csrf = payload?.csrf as string | undefined;
            // Use customerData.isSuperAdmin from API; JWT only when API omits it
            const isSuperAdminValue = customerData.isSuperAdmin ?? (payload?.isSuperAdmin === true);
            
            // Update customerData with isSuperAdmin
            const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdminValue };
            
            isAuthenticated.set(true);
            customer.set(updatedCustomerData);
            csrfToken.set(csrf || null);
            isSuperAdmin.set(isSuperAdminValue);
        } else {
            stopProactiveRefresh();
            isAuthenticated.set(false);
            customer.set(null);
            csrfToken.set(null);
            isSuperAdmin.set(false);
        }
    }

    function getIsAuthenticated(): boolean {
      return get(isAuthenticated);
    }

    /**
     * Set customer authentication state
     */
    function setCustomer(customerData: AuthenticatedCustomer | null): void {
        saveAuthState(customerData);
        if (customerData) {
          attachVisibilityListener(getIsAuthenticated, config);
          scheduleProactiveRefresh(getIsAuthenticated, config);
        }
    }
    
    /**
     * Login with JWT token (after OTP verification)
     * HttpOnly cookie is already set by the server
     */
    function login(jwtToken: string): void {
        const payload = decodeJWTPayload(jwtToken);
        if (!payload) {
            console.error('[Auth] Failed to decode JWT token');
            return;
        }
        
        const customerData: AuthenticatedCustomer = {
            customerId: payload.customerId as string || payload.sub as string,
            displayName: payload.displayName as string | undefined,
            token: jwtToken,
            expiresAt: payload.exp ? new Date(payload.exp as number * 1000).toISOString() : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
            isSuperAdmin: payload.isSuperAdmin as boolean || false,
        };
        
        saveAuthState(customerData);
        attachVisibilityListener(getIsAuthenticated, config);
        scheduleProactiveRefresh(getIsAuthenticated, config);
    }

    /**
     * Logout - clear HttpOnly cookie via API call
     */
    async function logout(): Promise<void> {
        stopProactiveRefresh();
        try {
            const apiUrl = config?.authApiUrl || 'https://auth.idling.app';
            
            const response = await fetch(`${apiUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Send HttpOnly cookie
            });
            
            if (!response.ok) {
                console.warn('[Auth] Logout API call failed:', response.status);
            }
        } catch (error) {
            console.warn('[Auth] Logout API call failed, continuing with local logout:', error);
        } finally {
            // Always clear local state
            saveAuthState(null);
            // Also try to delete cookie client-side (though server should have cleared it)
            deleteCookie('auth_token', '.idling.app', '/');
        }
    }
    
    /**
     * Check authentication status via /auth/me (HttpOnly cookie sent automatically).
     * Mirrors the Zustand adapter pattern -- never reads the cookie directly since
     * HttpOnly cookies are inaccessible to JavaScript.
     */
    async function checkAuth(): Promise<boolean> {
        try {
            let customerInfo = await fetchCustomerInfo(null, config);

            // Access token expired — attempt a silent refresh before giving up
            if (!customerInfo) {
                const refreshed = await refreshAuth(config);
                if (refreshed) {
                    customerInfo = await fetchCustomerInfo(null, config);
                }
            }

            if (customerInfo) {
                const authenticatedCustomer: AuthenticatedCustomer = {
                    customerId: customerInfo.customerId,
                    displayName: customerInfo.displayName || undefined,
                    isSuperAdmin: customerInfo.isSuperAdmin,
                };

                saveAuthState(authenticatedCustomer);
                attachVisibilityListener(getIsAuthenticated, config);
                scheduleProactiveRefresh(getIsAuthenticated, config);
                return true;
            }

            saveAuthState(null);
            return false;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[Auth] Check auth failed with critical error:', errorMessage);
            saveAuthState(null);
            throw new Error(`Authentication check failed: ${errorMessage}. Check your connection and that the auth service is running.`);
        }
    }
    
    /**
     * Fetch updated customer info from backend
     */
    async function fetchCustomerInfoFromAPI(): Promise<void> {
        try {
            const customerInfo = await fetchCustomerInfo(null, config);
            if (customerInfo && get(customer)) {
                const currentCustomer = get(customer);
                if (currentCustomer) {
                    const updatedCustomer: AuthenticatedCustomer = {
                        ...currentCustomer,
                        displayName: customerInfo.displayName || currentCustomer.displayName,
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    };
                    saveAuthState(updatedCustomer);
                }
            }
        } catch (error) {
            console.debug('[Auth] Failed to fetch customer info (non-critical):', error);
        }
    }
    
    /**
     * Load authentication state from HttpOnly cookie
     */
    async function loadAuthState(): Promise<void> {
        try {
            await checkAuth();
        } catch (error) {
            console.error('[Auth] Failed to load auth state:', error);
            saveAuthState(null);
        }
    }
    
    /**
     * Get current auth token from HttpOnly cookie
     * WARNING: This returns null because HttpOnly cookies cannot be read by JavaScript
     * The cookie is sent automatically with credentials: 'include'
     * This function exists for backward compatibility only
     */
    function getAuthToken(): string | null {
        // HttpOnly cookies cannot be read by JavaScript
        // Use isAuthenticated store to check authentication status
        return null;
    }
    
    /**
     * Get current CSRF token
     */
    function getCsrfToken(): string | null {
        return get(csrfToken);
    }
    
    return {
        // Stores
        customer,
        isAuthenticated,
        isSuperAdmin,
        csrfToken,
        isTokenExpired,
        
        // Methods
        setCustomer,
        login,
        logout,
        checkAuth,
        fetchCustomerInfo: fetchCustomerInfoFromAPI,
        loadAuthState,
        getAuthToken,
        getCsrfToken,
    };
}

// Export types for convenience
export type { AuthenticatedCustomer, AuthStoreConfig } from '../core/types';
