/**
 * Auth store using shared @strixun/auth-store package
 * This is a wrapper that exports the Svelte store for the main app
 * 
 * NOTE: This is the new implementation. Once tested, replace auth.ts with this.
 */

import { createAuthStore } from '@strixun/auth-store/svelte';
import { secureFetch } from '../core/services/encryption';

// Get OTP Auth API URL
function getOtpAuthApiUrl(): string {
    // Try to get from window config (injected during build)
    if (typeof window !== 'undefined') {
        if ((window as any).getOtpAuthApiUrl) {
            return (window as any).getOtpAuthApiUrl() || '';
        }
        // Fallback to hardcoded URL
        return 'https://auth.idling.app';
    }
    return '';
}

// Create the auth store
const authStore = createAuthStore({
    authApiUrl: getOtpAuthApiUrl(),
    storageKey: 'auth_user',
    enableSessionRestore: true,
    enableTokenValidation: true,
    sessionRestoreTimeout: 10000,
    tokenValidationTimeout: 5000,
});

// Export stores (for backward compatibility)
export const { 
    user, 
    isAuthenticated, 
    isSuperAdmin, 
    csrfToken, 
    isTokenExpired 
} = authStore;

// Export methods
export const { 
    setUser, 
    logout, 
    restoreSession, 
    fetchUserInfo, 
    loadAuthState, 
    getAuthToken, 
    getCsrfToken 
} = authStore;

// Re-export types
export type { User, AuthState } from '@strixun/auth-store/core';

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
export const setAuth = setUser;
export const clearAuth = () => setUser(null);

// Derived store for authRequired (legacy compatibility)
import { derived } from 'svelte/store';
import { encryptionEnabled } from '../modules/storage';

export const authRequired = derived(
    [encryptionEnabled, isAuthenticated],
    ([$encryptionEnabled, $isAuthenticated]) => {
        return $encryptionEnabled && !$isAuthenticated;
    }
);
