/**
 * Core API functions for auth store
 * Framework-agnostic API calls that work across all implementations
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage
 * - Cookies handle everything
 */

import type { AuthenticatedCustomer, AuthStoreConfig } from './types.js';

/**
 * Get OTP Auth API URL from config or environment
 */
export function getAuthApiUrl(config?: AuthStoreConfig): string {
    // Priority 1: Config override
    if (config?.authApiUrl) {
        return config.authApiUrl;
    }
    
    // Priority 2: Environment variable (for E2E tests)
    if (typeof window !== 'undefined' && (window as any).VITE_AUTH_API_URL) {
        return (window as any).VITE_AUTH_API_URL;
    }
    
    // Priority 3: Vite env (for development)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
        return import.meta.env.VITE_AUTH_API_URL;
    }
    
    // Priority 4: Window config (injected during build)
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
        const url = (window as any).getOtpAuthApiUrl();
        if (url) return url;
    }
    
    // Priority 5: Check if running on localhost (CRITICAL: NO FALLBACKS ON LOCAL)
    if (typeof window !== 'undefined') {
        const isLocalhost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' ||
                            import.meta.env?.DEV ||
                            import.meta.env?.MODE === 'development';
        
        if (isLocalhost) {
            // NEVER fall back to production when on localhost
            return 'http://localhost:8787';
        }
    }
    
    // Priority 6: Development proxy (Vite)
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        return '/auth-api';
    }
    
    // Priority 7: Production default (only if NOT on localhost)
    return 'https://auth.idling.app';
}

/**
 * Get token from HttpOnly cookie
 * This is read-only - we can't access the cookie value in JS (HttpOnly)
 * But we can check if it exists by making an API call
 */
function getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    // We can't read HttpOnly cookies from JavaScript
    // The cookie is automatically sent with requests
    // So we return null here - the cookie will be sent automatically
    return null;
}

/**
 * Fetch customer info from /auth/me to get admin status, displayName, and customerId
 * CRITICAL: Cookie is sent automatically with request
 * 
 * NOTE: /auth/me returns encrypted responses that need to be decrypted with the JWT token
 */
export async function fetchCustomerInfo(
    token: string | null, // Ignored - cookie is used instead
    config?: AuthStoreConfig
): Promise<{ isSuperAdmin: boolean; displayName?: string | null; customerId: string } | null> {
    try {
        const apiUrl = getAuthApiUrl(config);
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: apiUrl,
            timeout: 10000,
            // No auth config needed - cookie is sent automatically
            cache: {
                enabled: false, // CRITICAL: Never cache /auth/me
            },
        });
        
        // Cookie is sent automatically with request
        const response = await authClient.get<{ 
            isSuperAdmin?: boolean; 
            displayName?: string | null; 
            customerId: string; 
            [key: string]: any;
        }>('/auth/me', undefined, {
            metadata: {
                cache: false, // Explicitly disable caching
            },
            // Credentials: 'include' ensures cookies are sent
            credentials: 'include',
        });
        
        if (response.status === 200 && response.data) {
            return {
                isSuperAdmin: response.data.isSuperAdmin || false,
                displayName: response.data.displayName || null,
                customerId: response.data.customerId || '',
            };
        }
        
        return null;
    } catch (error) {
        console.error('[Auth] Failed to fetch customer info:', error instanceof Error ? error.message : String(error));
        return null;
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
