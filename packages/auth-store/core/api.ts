/**
 * Core API functions for auth store
 * Framework-agnostic API calls that work across all implementations
 */

import type { User, AuthStoreConfig } from './types.js';

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
    
    // Priority 5: Development proxy (Vite)
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        return '/auth-api';
    }
    
    // Priority 6: Production default
    return 'https://auth.idling.app';
}

/**
 * Restore session from backend based on IP address
 * This enables cross-application session sharing for the same device
 */
export async function restoreSessionFromBackend(config?: AuthStoreConfig): Promise<User | null> {
    try {
        const apiUrl = getAuthApiUrl(config);
        if (!apiUrl) {
            console.warn('[Auth] Auth API URL not configured, skipping session restoration');
            return null;
        }

        // Use the API framework client which already handles secureFetch internally
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: apiUrl,
            timeout: config?.sessionRestoreTimeout || 10000,
        });
        
        const response = await authClient.post<{ 
            restored: boolean; 
            access_token?: string; 
            token?: string; 
            userId?: string; 
            sub?: string; 
            email?: string; 
            displayName?: string | null; 
            customerId?: string | null; 
            expiresAt?: string;
            isSuperAdmin?: boolean;
        }>('/auth/restore-session', {});

        if (response.status !== 200 || !response.data) {
            // Not an error - just no session found
            if (response.status === 200 && response.data && !response.data.restored) {
                return null;
            } else {
                console.warn('[Auth] Session restoration failed:', response.status);
                return null;
            }
        }

        const data = response.data;
        if (data.restored && data.access_token) {
            // Session restored! Return user data
            const userId = data.userId || data.sub;
            const email = data.email;
            const token = data.access_token || data.token;
            const expiresAt = data.expiresAt;

            if (!userId || !email || !token || !expiresAt) {
                console.warn('[Auth] Session restoration incomplete - missing required fields');
                return null;
            }

            const user: User = {
                userId,
                email,
                displayName: data.displayName || null,
                customerId: data.customerId || null,
                token,
                expiresAt,
                isSuperAdmin: data.isSuperAdmin || false,
            };
            
            console.log('[Auth] ✓ Session restored from backend for user:', user.email);
            return user;
        }

        if (data.restored === false) {
            console.log('[Auth] No active session found for this IP address');
        } else {
            console.warn('[Auth] Unexpected response format from restore-session:', { 
                restored: data.restored, 
                hasToken: !!data.access_token 
            });
        }

        return null;
    } catch (error) {
        // Log error for debugging (session restoration is optional but we want to know if it's failing)
        console.warn('[Auth] Session restoration error:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.debug('[Auth] Session restoration stack:', error.stack);
        }
        return null;
    }
}

/**
 * Validate token with backend to check if it's blacklisted or invalid
 * Returns true if token is valid, false if invalid/blacklisted
 * 
 * CRITICAL: This ensures we detect tokens that were blacklisted on other domains
 * 
 * If token mismatch occurs (token was refreshed/changed), this function will return false
 * and the caller should restore the session to get a fresh token.
 */
export async function validateTokenWithBackend(
    token: string, 
    config?: AuthStoreConfig
): Promise<boolean> {
    if (!config?.enableTokenValidation) {
        return true; // Skip validation if disabled
    }
    
    try {
        const apiUrl = getAuthApiUrl(config);
        if (!apiUrl) {
            // If no API URL configured, skip validation (graceful degradation)
            return true;
        }

        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: apiUrl,
            timeout: config?.tokenValidationTimeout || 5000,
            auth: {
                tokenGetter: () => {
                    // CRITICAL: Return token so Authorization header is set
                    if (!token || typeof token !== 'string' || token.trim().length === 0) {
                        return null;
                    }
                    return token;
                },
            },
            cache: {
                enabled: false, // Never cache validation requests
            },
        });
        
        // Use /auth/me endpoint to validate token (returns 401 if invalid/blacklisted)
        const response = await authClient.get('/auth/me', undefined, {
            metadata: {
                token: token, // Pass token in metadata for decryption (if response is encrypted)
                cache: false, // Never cache validation requests
            },
        });
        
        // 200 = valid, 401 = invalid/blacklisted
        return response.status === 200;
    } catch (error) {
        // Check if this is a token mismatch error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTokenMismatch = errorMessage.includes('token does not match') || 
                                errorMessage.includes('Token mismatch') ||
                                errorMessage.includes('decryption failed');
        
        if (isTokenMismatch) {
            // Token mismatch means the stored token is stale - return false so caller can restore session
            console.warn('[Auth] Token mismatch detected during validation - stored token is stale:', {
                error: errorMessage,
                note: 'The stored token does not match the token used for encryption. This usually means the token was refreshed or changed. Returning false so caller can restore the session.'
            });
            return false; // Token is invalid (stale)
        }
        
        // Network errors or other issues - assume valid to avoid blocking initialization
        console.warn('[Auth] Token validation failed (assuming valid):', errorMessage);
        return true; // Assume valid to avoid blocking initialization
    }
}

/**
 * Fetch user info from /auth/me to get admin status, displayName, and customerId
 * CRITICAL: Disable caching for this endpoint - we always need fresh user data
 * Also handles undefined cached values gracefully
 * 
 * NOTE: /auth/me returns encrypted responses that need to be decrypted with the JWT token
 * 
 * If token mismatch occurs (token was refreshed/changed), this function will return null
 * and the caller should restore the session to get a fresh token.
 */
export async function fetchUserInfo(
    token: string,
    config?: AuthStoreConfig
): Promise<{ isSuperAdmin: boolean; displayName?: string | null; customerId?: string | null } | null> {
    // CRITICAL: Validate token exists before making request
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.error('[Auth] fetchUserInfo called with invalid token:', { 
            hasToken: !!token, 
            tokenType: typeof token, 
            tokenLength: token?.length 
        });
        return null;
    }
    
    try {
        const apiUrl = getAuthApiUrl(config);
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: apiUrl,
            timeout: 10000, // Increased to 10 seconds to handle slower responses
            auth: {
                tokenGetter: () => {
                    // Double-check token is still valid
                    if (!token || typeof token !== 'string' || token.trim().length === 0) {
                        console.warn('[Auth] tokenGetter returned invalid token');
                        return null;
                    }
                    return token;
                },
            },
            cache: {
                enabled: false, // CRITICAL: Never cache /auth/me - always fetch fresh to avoid undefined cache hits
            },
        });
        
        // CRITICAL: Pass token in metadata so the response handler can decrypt encrypted responses
        const response = await authClient.get<{ 
            isSuperAdmin?: boolean; 
            displayName?: string | null; 
            customerId?: string | null; 
            [key: string]: any;
        }>('/auth/me', undefined, {
            metadata: {
                cache: false, // Explicitly disable caching for this request
                token: token, // Pass token in metadata for decryption
            },
        });
        
        console.log('[Auth] /auth/me response:', { 
            status: response.status, 
            hasData: !!response.data,
            dataType: typeof response.data,
            dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : null,
        });
        
        if (response.status === 200 && response.data) {
            // Validate that we got actual data, not undefined
            if (response.data === undefined || response.data === null) {
                console.error('[Auth] /auth/me returned undefined/null data - this indicates a decryption or caching issue');
                return null;
            }
            
            // Check if response is still encrypted (decryption failed)
            if (typeof response.data === 'object' && 'encrypted' in response.data && (response.data as any).encrypted === true) {
                console.error('[Auth] /auth/me response is still encrypted - decryption failed (token mismatch):', {
                    tokenLength: token.length,
                    tokenPrefix: token.substring(0, 20) + '...',
                    hasEncryptedFlag: true,
                    responseStatus: response.status,
                    note: 'Token mismatch detected - the stored token does not match the token used for encryption. This usually means the token was refreshed or changed. The caller should restore the session to get a fresh token.'
                });
                return null;
            }
            
            return {
                isSuperAdmin: response.data.isSuperAdmin || false,
                displayName: response.data.displayName || null,
                customerId: response.data.customerId || null,
            };
        }
        
        console.warn('[Auth] /auth/me returned non-200 status:', response.status);
        return null;
    } catch (error) {
        // Check if this is a token mismatch error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTokenMismatch = errorMessage.includes('token does not match') || 
                                errorMessage.includes('Token mismatch') ||
                                errorMessage.includes('decryption failed');
        
        if (isTokenMismatch) {
            console.warn('[Auth] Token mismatch detected in fetchUserInfo - stored token is stale:', {
                error: errorMessage,
                note: 'The stored token does not match the token used for encryption. This usually means the token was refreshed or changed. The caller should restore the session to get a fresh token.'
            });
        } else {
            console.error('[Auth] Failed to fetch user info:', errorMessage);
            if (error instanceof Error && error.stack) {
                console.debug('[Auth] fetchUserInfo error stack:', error.stack);
            }
        }
        return null;
    }
}

/**
 * Decode JWT payload (without verification - for extracting CSRF token and other claims)
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
