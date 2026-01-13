/**
 * Shared Authentication Configuration
 * Used by all API clients (Mods API, Customer API)
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - Token is in HttpOnly cookie (inaccessible to JavaScript)
 * - Browser automatically sends cookie with credentials: 'include'
 * - NO token reading from localStorage or Zustand state
 */

import { getCookie } from '@strixun/auth-store/core/utils';

/**
 * Check if user is authenticated
 * This checks the Zustand store's authentication state
 * NOTE: This does NOT return the token (token is in HttpOnly cookie)
 */
export async function isAuthenticated(): Promise<boolean> {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        return store.isAuthenticated;
    } catch (error) {
        console.debug('[Auth] Could not access auth store:', error);
        return false;
    }
}

/**
 * Get authentication token from HttpOnly cookie
 * 
 * ⚠️ IMPORTANT: This function is deprecated for HttpOnly cookie auth.
 * With HttpOnly cookies, the token cannot be accessed by JavaScript.
 * 
 * The browser automatically sends the auth_token cookie with every request
 * when you use credentials: 'include' in fetch options.
 * 
 * This function is kept for backward compatibility with old API clients
 * but returns null. Update your API clients to use credentials: 'include'
 * instead of tokenGetter.
 * 
 * @deprecated Use credentials: 'include' in fetch options instead
 * @returns null (token is inaccessible in HttpOnly cookie)
 */
export async function getAuthToken(): Promise<string | null> {
    console.warn(
        '[Auth] getAuthToken() is deprecated. ' +
        'Token is in HttpOnly cookie and cannot be read by JavaScript. ' +
        'Use credentials: "include" in your API client configuration.'
    );
    
    // With HttpOnly cookies, we cannot and should not read the token
    // The browser sends it automatically with credentials: 'include'
    return null;
}

/**
 * Shared authentication configuration for all API clients
 * 
 * ⚠️ DEPRECATED: tokenGetter approach is deprecated.
 * Modern approach: Don't use tokenGetter, just use credentials: 'include'
 * 
 * @deprecated Configure your API client with credentials: 'include' instead
 */
export const sharedAuthConfig = {
    tokenGetter: getAuthToken,
    onTokenExpired: () => {
        if (typeof window !== 'undefined') {
            console.warn('[Auth] Token expired, clearing auth state');
            // Clear Zustand store
            import('../stores/auth').then(({ useAuthStore }) => {
                useAuthStore.getState().logout();
            }).catch(() => {
                // Ignore errors if store isn't available
            });
            
            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }
    },
};

/**
 * Shared client configuration for all API clients
 * 
 * MODERN APPROACH: Use this configuration which relies on HttpOnly cookies
 */
export const sharedClientConfig = {
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
    // CRITICAL: Include credentials to send HttpOnly cookies
    credentials: 'include' as RequestCredentials,
    // Legacy auth config (deprecated - cookie is sent automatically)
    auth: sharedAuthConfig,
    timeout: 30000,
    retry: {
        maxAttempts: 3,
        backoff: 'exponential' as const,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: [408, 429, 500, 502, 503, 504],
    },
    features: {
        cancellation: true,
        logging: import.meta.env.DEV,
        deduplication: false,
        queue: false,
        circuitBreaker: false,
        offlineQueue: false,
        optimisticUpdates: false,
        metrics: false,
    },
};

/**
 * RECOMMENDED: Modern client configuration without tokenGetter
 * Use this for new API clients to fully embrace HttpOnly cookie auth
 */
export const modernClientConfig = {
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
    // HttpOnly cookie is sent automatically with credentials: 'include'
    credentials: 'include' as RequestCredentials,
    // No auth.tokenGetter needed - cookie handles everything!
    auth: {
        onTokenExpired: () => {
            if (typeof window !== 'undefined') {
                import('../stores/auth').then(({ useAuthStore }) => {
                    useAuthStore.getState().logout();
                }).catch(() => {});
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
        },
    },
    timeout: 30000,
    retry: {
        maxAttempts: 3,
        backoff: 'exponential' as const,
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: [408, 429, 500, 502, 503, 504],
    },
    features: {
        cancellation: true,
        logging: import.meta.env.DEV,
        deduplication: false,
        queue: false,
        circuitBreaker: false,
        offlineQueue: false,
        optimisticUpdates: false,
        metrics: false,
    },
};
