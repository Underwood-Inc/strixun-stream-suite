/**
 * Auth store using shared @strixun/auth-store package with HttpOnly cookie SSO
 * This implementation uses the new cookie-based auth for true Single Sign-On
 */

import { createAuthStore } from '@strixun/auth-store/svelte';
import { secureFetch } from '../core/services/encryption';
import type { AuthenticatedCustomer } from '@strixun/auth-store';

// Get OTP Auth API URL
function getOtpAuthApiUrl(): string {
    // Try to get from window config (injected during build)
    if (typeof window !== 'undefined') {
        // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
        const isLocalhost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' ||
                            import.meta.env?.DEV ||
                            import.meta.env?.MODE === 'development';
        
        if (isLocalhost) {
            // NEVER fall back to production when on localhost
            return 'http://localhost:8787';
        }
        
        // Priority 1: VITE_AUTH_API_URL (for E2E tests, set by playwright config)
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
            const viteUrl = import.meta.env.VITE_AUTH_API_URL;
            if (viteUrl) {
                return viteUrl;
            }
        }
        
        // Priority 2: window.getOtpAuthApiUrl() (from config.js)
        if ((window as any).getOtpAuthApiUrl) {
            const url = (window as any).getOtpAuthApiUrl();
            if (url) {
                return url;
            }
        }
        
        // Only use production URL if NOT on localhost
        return 'https://auth.idling.app';
    }
    return '';
}

// Create the auth store with HttpOnly cookie SSO
const authStore = createAuthStore({
    authApiUrl: getOtpAuthApiUrl(),
    storageKey: 'auth-storage', // Use consistent key across all apps
});

// Export stores (for backward compatibility)
export const { 
    customer,
    isAuthenticated, 
    isSuperAdmin, 
    csrfToken, 
    isTokenExpired 
} = authStore;

// Export methods
export const { 
    setCustomer,
    login,
    logout, 
    checkAuth,
    fetchCustomerInfo,
    getAuthToken, 
    getCsrfToken 
} = authStore;

// Re-export types
export type { AuthenticatedCustomer } from '@strixun/auth-store';

// Legacy helpers for backward compatibility
export function getApiUrl(): string {
    // Try to get from window config (injected during build)
    if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
        return (window as any).getWorkerApiUrl() || '';
    }
    return '';
}

/**
 * Make authenticated API request
 * Legacy helper for backward compatibility
 */
export async function authenticatedFetch(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }
    
    const apiUrl = getApiUrl();
    if (!apiUrl) {
        throw new Error('API URL not configured');
    }
    
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    
    // Add CSRF token for state-changing operations (POST, PUT, DELETE)
    const method = options.method || 'GET';
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        const csrf = getCsrfToken();
        if (csrf) {
            headers.set('X-CSRF-Token', csrf);
        }
    }
    
    // Use secureFetch to enforce HTTPS
    return secureFetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
    });
}

// Legacy aliases for backward compatibility
export const setAuth = setCustomer;
export const clearAuth = () => logout();
export const loadAuthState = checkAuth; // Map old loadAuthState to new checkAuth
export const restoreSession = checkAuth; // Map old restoreSession to new checkAuth

// Derived store for authRequired (legacy compatibility)
import { derived } from 'svelte/store';
import { encryptionEnabled } from '../modules/storage';

export const authRequired = derived(
    [encryptionEnabled, isAuthenticated],
    ([$encryptionEnabled, $isAuthenticated]) => {
        return $encryptionEnabled && !$isAuthenticated;
    }
);
