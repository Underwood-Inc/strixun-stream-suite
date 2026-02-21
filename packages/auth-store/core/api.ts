/**
 * Core API functions for auth store
 * Framework-agnostic API calls that work across all implementations
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage
 * - Cookies handle everything
 */

import type { AuthStoreConfig } from './types';

/**
 * Check if running in development/localhost
 */
function isDevelopment(): boolean {
    if (typeof window === 'undefined') return false;
    
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           (typeof import.meta !== 'undefined' && (import.meta.env?.DEV || import.meta.env?.MODE === 'development'));
}

/**
 * Get OTP Auth API URL from config or environment
 * 
 * Priority:
 * 1. Config override (authApiUrl)
 * 2. Window.VITE_AUTH_API_URL (for E2E tests)
 * 3. import.meta.env.VITE_AUTH_API_URL (for builds)
 * 4. window.getOtpAuthApiUrl() (from config.js)
 * 5. If localhost: '/auth-api' (Vite proxy) or 'http://localhost:8787'
 * 6. Production default: 'https://auth.idling.app'
 */
export function getAuthApiUrl(config?: AuthStoreConfig): string {
    // Priority 1: Config override
    if (config?.authApiUrl) {
        return config.authApiUrl;
    }
    
    // Priority 2: Development detection
    // CRITICAL: On localhost, ALWAYS use the Vite proxy path to ensure cookie SSO works across ports.
    // Do not allow env/config injection to override localhost defaults.
    if (isDevelopment()) {
        return '/auth-api';
    }
    
    // Priority 3: Window env (for E2E tests)
    if (typeof window !== 'undefined' && (window as any).VITE_AUTH_API_URL) {
        return (window as any).VITE_AUTH_API_URL;
    }
    
    // Priority 4: Vite env (for builds)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
        return import.meta.env.VITE_AUTH_API_URL;
    }
    
    // Priority 5: Window config (injected during build)
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
        const url = (window as any).getOtpAuthApiUrl();
        if (url) return url;
    }
    
    // Priority 6: Production default
    return 'https://auth.idling.app';
}

/**
 * Get Customer API URL from config or environment
 * 
 * Priority:
 * 1. Config override (customerApiUrl)
 * 2. import.meta.env.VITE_CUSTOMER_API_URL (for builds)
 * 3. window.VITE_CUSTOMER_API_URL (for E2E tests)
 * 4. If localhost: '/customer-api' (Vite proxy)
 * 5. Production default: 'https://customer-api.idling.app'
 */
export function getCustomerApiUrl(config?: AuthStoreConfig): string {
    // Priority 1: Config override
    if (config?.customerApiUrl) {
        return config.customerApiUrl;
    }
    
    // Priority 2: Development detection
    // CRITICAL: On localhost, ALWAYS use the Vite proxy path to ensure cookie SSO works across ports.
    // Do not allow env/config injection to override localhost defaults.
    if (isDevelopment()) {
        return '/customer-api';
    }
    
    // Priority 3: Vite env (for builds)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CUSTOMER_API_URL) {
        return import.meta.env.VITE_CUSTOMER_API_URL;
    }
    
    // Priority 4: Window env (for E2E tests)
    if (typeof window !== 'undefined' && (window as any).VITE_CUSTOMER_API_URL) {
        return (window as any).VITE_CUSTOMER_API_URL;
    }
    
    // Priority 5: Production default
    return 'https://customer-api.idling.app';
}

/**
 * Get token from HttpOnly cookie
 * This is read-only - we can't access the cookie value in JS (HttpOnly)
 * But we can check if it exists by making an API call
 */
// Note: getTokenFromCookie is not used - HttpOnly cookies are sent automatically
// This function is kept for reference but not called

/**
 * Fetch customer info from /auth/me (JWT payload: customerId, displayName, isSuperAdmin)
 * CRITICAL: Cookie is sent automatically with request
 */
export async function fetchCustomerInfo(
    _token: string | null, // Ignored - cookie is used instead
    config?: AuthStoreConfig
): Promise<{ isSuperAdmin: boolean; displayName?: string | null; customerId: string } | null> {
    const apiUrl = getAuthApiUrl(config);
    
    if (!apiUrl) {
        throw new Error('Auth API URL not configured. Check VITE_AUTH_API_URL environment variable.');
    }
    
    try {
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: apiUrl,
            timeout: 10000,
            // CRITICAL: Include credentials to send HttpOnly cookies
            credentials: 'include' as RequestCredentials,
            // No auth config needed - cookie is sent automatically
            cache: {
                enabled: false, // CRITICAL: Never cache /auth/me
            },
        });
        
        // Step 1: Get customerId and isSuperAdmin from /auth/me
        // Cookie is sent automatically with request
        let authResponse;
        try {
            authResponse = await authClient.get<{ 
                isSuperAdmin?: boolean; 
                customerId: string; 
                [key: string]: any;
            }>('/auth/me', undefined, {
                metadata: {
                    cache: false, // Explicitly disable caching
                },
            });
        } catch (networkError) {
            // 401/403 = not authenticated (expected on login page, no cookie, etc.) - return null
            const err = networkError as { status?: number };
            if (err?.status === 401 || err?.status === 403) {
                return null;
            }
            // Actual network/server errors - fail fast
            const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
            throw new Error(`Network error checking authentication: ${errorMessage}. Check your connection and that the auth service is running at ${apiUrl}.`);
        }
        
        // 401/403 means not authenticated - this is expected, return null (defensive; API client throws so we rarely reach here)
        if (authResponse.status === 401 || authResponse.status === 403) {
            return null;
        }
        
        // Other non-OK statuses are errors - fail fast
        if (authResponse.status !== 200 || !authResponse.data) {
            const errorText = authResponse.data ? JSON.stringify(authResponse.data) : 'Unknown error';
            throw new Error(`Auth service returned error ${authResponse.status}: ${errorText}. Check auth service configuration.`);
        }
        
        const customerId = authResponse.data.customerId;
        const isSuperAdmin = authResponse.data.isSuperAdmin || false;
        const displayName: string | null = authResponse.data.displayName || null;

        return {
            isSuperAdmin,
            displayName,
            customerId,
        };
    } catch (error) {
        // If it's already our error, re-throw it (fail-fast)
        if (error instanceof Error && (error.message.includes('Network error') || error.message.includes('Auth service returned error'))) {
            throw error;
        }
        
        // For other errors, wrap and throw (fail-fast)
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch customer info: ${errorMessage}. Check auth service configuration.`);
    }
}

/**
 * In-flight refresh promise for deduplication.
 * Multiple concurrent callers (e.g. checkAuth + 401 retries) share one refresh attempt
 * so we don't hammer /auth/refresh or race token rotation.
 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the current session by exchanging the HttpOnly
 * refresh_token cookie for a new access + refresh token pair.
 *
 * Deduplication: concurrent callers share a single refresh; only one POST /auth/refresh runs.
 * Retry: one transient failure is retried after a short backoff to avoid unnecessary
 * logouts (and burning OTP rate limit when the user tries to log back in).
 *
 * @returns `true` when the server set new cookies (session extended),
 *          `false` when the refresh token is invalid/expired (must re-login).
 */
export async function refreshAuth(config?: AuthStoreConfig): Promise<boolean> {
    if (refreshPromise) {
        return refreshPromise;
    }

    const doRefresh = async (): Promise<boolean> => {
        const apiUrl = getAuthApiUrl(config);
        try {
            const res = await fetch(`${apiUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) return true;
            if (res.status === 401) return false;
            // 5xx or other: retry once after backoff
            await new Promise((r) => setTimeout(r, 400));
            const retry = await fetch(`${apiUrl}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });
            return retry.ok;
        } catch {
            await new Promise((r) => setTimeout(r, 400));
            try {
                const retry = await fetch(`${apiUrl}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                });
                return retry.ok;
            } catch {
                return false;
            }
        } finally {
            refreshPromise = null;
        }
    };

    refreshPromise = doRefresh();
    return refreshPromise;
}

/**
 * Options for fetch-with-401-retry: max attempts and optional progressive backoff.
 */
export interface FetchWithAuthRetryOptions {
    /** Called on 401 to refresh session. Default: () => refreshAuth() */
    tryRefresh?: () => Promise<boolean>;
    /** Max total attempts (initial + retries). Default 3. */
    maxAttempts?: number;
    /** Backoff strategy between retries: none, linear, or exponential. Default 'none'. */
    backoff?: 'none' | 'linear' | 'exponential';
    /** Initial delay in ms (used for linear/exponential). Default 200. */
    initialDelayMs?: number;
    /** Cap delay in ms. Default 2000. */
    maxDelayMs?: number;
}

/**
 * Compute delay before the next retry (1-based attempt = which retry we're about to do).
 */
function authRetryDelay(
    attempt: number,
    backoff: 'none' | 'linear' | 'exponential',
    initialDelayMs: number,
    maxDelayMs: number
): number {
    if (backoff === 'none' || attempt < 1) return 0;
    let delay: number;
    if (backoff === 'exponential') {
        delay = initialDelayMs * Math.pow(2, attempt - 1);
    } else {
        delay = initialDelayMs * attempt;
    }
    return Math.min(delay, maxDelayMs);
}

/**
 * Fetch with 401 handling: up to maxAttempts attempts, calling tryRefresh on 401 and retrying.
 * Optional progressive backoff (linear or exponential) between retries.
 * Use this for any credentialed request so 401 does not trigger infinite retry loops.
 *
 * @param url - Full URL to fetch
 * @param options - Standard RequestInit (must use credentials: 'include' for cookie auth)
 * @param retryOptions - maxAttempts (default 3), optional tryRefresh, backoff, initialDelayMs, maxDelayMs
 * @returns Last response (caller should check response.ok / response.status)
 */
export async function fetchWithAuthRetry(
    url: string,
    options: RequestInit,
    retryOptions?: FetchWithAuthRetryOptions
): Promise<Response> {
    const tryRefresh = retryOptions?.tryRefresh ?? (() => refreshAuth());
    const maxAttempts = Math.max(1, retryOptions?.maxAttempts ?? 3);
    const backoff = retryOptions?.backoff ?? 'none';
    const initialDelayMs = Math.max(0, retryOptions?.initialDelayMs ?? 200);
    const maxDelayMs = Math.max(initialDelayMs, retryOptions?.maxDelayMs ?? 2000);

    let lastResponse: Response | null = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;
        lastResponse = await fetch(url, options);

        if (lastResponse.status !== 401) {
            return lastResponse;
        }

        const refreshed = await tryRefresh();
        if (!refreshed) {
            return lastResponse;
        }

        if (attempt >= maxAttempts) {
            return lastResponse;
        }

        const delay = authRetryDelay(attempt, backoff, initialDelayMs, maxDelayMs);
        if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    return lastResponse!;
}

/**
 * Decode JWT payload (without verification - for extracting CSRF token and other claims)
 * NOTE: With HttpOnly cookies, we can't access the token directly
 * This function is kept for backward compatibility but will return null
 */
export function decodeJWTPayload(jwt: string): { csrf?: string; isSuperAdmin?: boolean; [key: string]: unknown } | null {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return null;
        
        const payloadB64 = parts[1];
        // Decode base64 URL-safe
        const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
        );
        
        return payload;
    } catch (error) {
        return null;
    }
}
