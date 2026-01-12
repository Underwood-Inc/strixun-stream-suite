/**
 * Shared Authentication Configuration
 * Used by all API clients (Mods API, Customer API)
 * Reads token from Zustand persisted auth store (localStorage['auth-storage'])
 */

/**
 * Get authentication token from storage
 * Checks multiple sources to ensure token is found
 * Priority: Zustand store → localStorage → legacy keys
 */
export async function getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
        return null;
    }

    // Priority 1: Try to get token from Zustand store directly (most reliable)
    try {
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        if (store.customer?.token) {
            const token = store.customer.token.trim();
            if (token && token.length > 0) {
                console.log('[Auth] Token retrieved from Zustand store');
                return token;
            }
        }
    } catch (error) {
        console.debug('[Auth] Could not access auth store directly:', error);
    }
    
    // Priority 2: Read directly from localStorage (works even if store isn't hydrated)
    try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
            const parsed = JSON.parse(authStorage);
            let token: string | null = null;
            if (parsed?.customer?.token) {
                token = parsed.customer.token;
            } else if (parsed?.state?.customer?.token) {
                token = parsed.state.customer.token;
            }
            
            if (token) {
                const trimmedToken = token.trim();
                if (trimmedToken && trimmedToken.length > 0) {
                    console.log('[Auth] Token retrieved from localStorage');
                    return trimmedToken;
                }
            }
        }
    } catch (error) {
        console.warn('[Auth] Failed to parse auth storage:', error);
    }
    
    // Priority 3: Legacy keys for backwards compatibility
    const legacyToken = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
    if (legacyToken) {
        const trimmedToken = legacyToken.trim();
        if (trimmedToken && trimmedToken.length > 0) {
            console.log('[Auth] Token retrieved from legacy storage');
            return trimmedToken;
        }
    }
    
    console.warn('[Auth] No token found in any storage location');
    return null;
}

/**
 * Shared authentication configuration for all API clients
 * Provides consistent auth behavior across all services
 */
export const sharedAuthConfig = {
    tokenGetter: getAuthToken,
    onTokenExpired: () => {
        if (typeof window !== 'undefined') {
            console.warn('[Auth] Token expired, clearing auth state');
            // Clear Zustand persisted store
            localStorage.removeItem('auth-storage');
            // Clear legacy keys for backwards compatibility
            localStorage.removeItem('auth_token');
            localStorage.removeItem('access_token');
            // Dispatch logout event
            window.dispatchEvent(new CustomEvent('auth:logout'));
            // Also clear the store if possible
            import('../stores/auth').then(({ useAuthStore }) => {
                useAuthStore.getState().logout();
            }).catch(() => {
                // Ignore errors if store isn't available
            });
        }
    },
};

/**
 * Shared client configuration for all API clients
 */
export const sharedClientConfig = {
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
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
