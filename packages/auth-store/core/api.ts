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
 * Fetch customer info from /auth/me and /customer/me to get admin status, displayName, and customerId
 * CRITICAL: Cookie is sent automatically with request
 * 
 * NOTE: /auth/me returns JWT payload data only (no displayName)
 * We need to call /customer/me to get displayName from Customer API
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
            // Network errors are critical - fail fast
            const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
            throw new Error(`Network error checking authentication: ${errorMessage}. Check your connection and that the auth service is running at ${apiUrl}.`);
        }
        
        // 401/403 means not authenticated - this is expected, return null
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
        
        // Step 2: Fetch displayName from Customer API
        const customerApiUrl = getCustomerApiUrl(config);
        
        let displayName: string | null = null;
        try {
            const customerClient = createAPIClient({
                baseURL: customerApiUrl,
                timeout: 10000,
                cache: {
                    enabled: false,
                },
            });
            
            const customerResponse = await customerClient.get<{
                displayName?: string | null;
                [key: string]: any;
            }>('/customer/me', undefined, {
                metadata: {
                    cache: false,
                },
            });
            
            if (customerResponse.status === 200 && customerResponse.data) {
                displayName = customerResponse.data.displayName || null;
            }
        } catch (customerError) {
            // If Customer API call fails, we still return auth data (just without displayName)
            console.warn('[Auth] Failed to fetch displayName from Customer API:', 
                customerError instanceof Error ? customerError.message : String(customerError));
        }
        
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
