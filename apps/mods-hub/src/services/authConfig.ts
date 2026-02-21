/**
 * Shared Authentication Configuration
 * Used by all API clients (Mods API, Customer API)
 *
 * CRITICAL: HttpOnly cookie-based authentication
 * - Token is in HttpOnly cookie (inaccessible to JavaScript)
 * - Browser automatically sends cookie with credentials: 'include'
 * - NO token reading, NO tokenGetter, NO manual Authorization headers
 * - On 401 we try refresh (POST /auth/refresh); only logout if refresh fails.
 */

import { refreshAuth } from '@strixun/auth-store/core/api';

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
 * Shared client configuration for all API clients
 *
 * HttpOnly cookie auth - cookie sent with credentials: 'include'.
 * Domain=.idling.app set by auth service so cookie reaches mods-api.idling.app.
 */
export const sharedClientConfig = {
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
    credentials: 'include' as RequestCredentials,
    auth: {
        onTokenExpired: async () => {
            if (typeof window === 'undefined') return;
            const ok = await refreshAuth();
            if (!ok) {
                const { useAuthStore } = await import('../stores/auth');
                useAuthStore.getState().logout();
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
        onTokenExpired: async () => {
            if (typeof window === 'undefined') return;
            const ok = await refreshAuth();
            if (!ok) {
                const { useAuthStore } = await import('../stores/auth');
                useAuthStore.getState().logout();
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
