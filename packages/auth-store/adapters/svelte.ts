/**
 * Svelte adapter for auth store - HttpOnly Cookie SSO
 * Use this in Svelte projects
 * 
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists
 * CRITICAL: Tokens are stored in HttpOnly cookies, NOT localStorage
 */

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { AuthenticatedCustomer, AuthStoreConfig } from '../core/types.js';
import { fetchCustomerInfo, decodeJWTPayload } from '../core/api.js';
import { getCookie, deleteCookie } from '../core/utils.js';

/**
 * Create Svelte auth stores with HttpOnly cookie SSO
 */
export function createAuthStore(config?: AuthStoreConfig) {
    // Core stores
    const customer: Writable<AuthenticatedCustomer | null> = writable(null);
    const isAuthenticated: Writable<boolean> = writable(false);
    const isSuperAdmin: Writable<boolean> = writable(false);
    const csrfToken: Writable<string | null> = writable(null);
    
    // Derived stores
    const isTokenExpired: Readable<boolean> = derived(
        customer,
        ($customer) => {
            if (!$customer) return true;
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
            const payload = decodeJWTPayload(customerData.token);
            const csrf = payload?.csrf as string | undefined;
            const isSuperAdminValue = payload?.isSuperAdmin === true || customerData.isSuperAdmin || false;
            
            // Update customerData with isSuperAdmin from JWT if not already set
            const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdminValue };
            
            isAuthenticated.set(true);
            customer.set(updatedCustomerData);
            csrfToken.set(csrf || null);
            isSuperAdmin.set(isSuperAdminValue);
        } else {
            isAuthenticated.set(false);
            customer.set(null);
            csrfToken.set(null);
            isSuperAdmin.set(false);
        }
    }
    
    /**
     * Set customer authentication state
     */
    function setCustomer(customerData: AuthenticatedCustomer | null): void {
        saveAuthState(customerData);
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
            email: payload.email as string,
            displayName: payload.displayName as string | undefined,
            token: jwtToken,
            expiresAt: payload.exp ? new Date(payload.exp as number * 1000).toISOString() : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
            isSuperAdmin: payload.isSuperAdmin as boolean || false,
        };
        
        saveAuthState(customerData);
    }
    
    /**
     * Logout - clear HttpOnly cookie via API call
     */
    async function logout(): Promise<void> {
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
     * Check authentication status from HttpOnly cookie
     */
    async function checkAuth(): Promise<boolean> {
        try {
            const authToken = getCookie('auth_token');
            if (!authToken) {
                console.debug('[Auth] No auth token cookie found');
                saveAuthState(null);
                return false;
            }
            
            // Fetch customer info from /auth/me to validate token
            const customerInfo = await fetchCustomerInfo(config);
            
            if (customerInfo) {
                const payload = decodeJWTPayload(authToken);
                const customerId = customerInfo.customerId || payload?.customerId as string;
                const email = payload?.email as string;
                const expiresAt = payload?.exp ? new Date(payload.exp as number * 1000).toISOString() : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
                
                const authenticatedCustomer: AuthenticatedCustomer = {
                    customerId,
                    email,
                    displayName: customerInfo.displayName || undefined,
                    token: authToken,
                    expiresAt,
                    isSuperAdmin: customerInfo.isSuperAdmin,
                };
                
                saveAuthState(authenticatedCustomer);
                console.log('[Auth] ✓ Session restored from HttpOnly cookie for customer:', email);
                return true;
            } else {
                // Token invalid or expired on backend
                deleteCookie('auth_token', '.idling.app', '/');
                saveAuthState(null);
                console.warn('[Auth] Token in HttpOnly cookie invalid or expired, cleared');
                return false;
            }
        } catch (error) {
            console.error('[Auth] Error during checkAuth:', error);
            deleteCookie('auth_token', '.idling.app', '/');
            saveAuthState(null);
            return false;
        }
    }
    
    /**
     * Fetch updated customer info from backend
     */
    async function fetchCustomerInfoFromAPI(): Promise<void> {
        try {
            const customerInfo = await fetchCustomerInfo(config);
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
     */
    function getAuthToken(): string | null {
        return getCookie('auth_token');
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
export type { AuthenticatedCustomer, AuthStoreConfig } from '../core/types.js';
