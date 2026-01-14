/**
 * Shared Authentication Check Utilities
 * 
 * Provides unified auth checking with fail-fast error handling across all apps.
 * Distinguishes between "not authenticated" (401/403) and critical errors (network, 500, etc.)
 * 
 * USAGE:
 *   import { checkAuth, type AuthCheckResult } from '@strixun/otp-auth-service/shared/auth-check';
 *   
 *   const result = await checkAuth();
 *   if (result) {
 *     // Authenticated: result.customerId, result.displayName, result.isSuperAdmin
 *   } else {
 *     // Not authenticated (401/403) - show login screen
 *   }
 */

import { getAuthApiUrl, getCustomerApiUrl, type AuthUrlConfig } from './auth-urls';

/**
 * Result of authentication check
 */
export interface AuthCheckResult {
    customerId: string;
    displayName?: string | null;
    isSuperAdmin: boolean;
}

/**
 * Check authentication status by calling /auth/me and /customer/me
 * Cookie is sent automatically with credentials: 'include'
 * 
 * FAIL-FAST: Throws errors for network issues, returns null only for "not authenticated"
 * 
 * @param config Optional URL configuration
 * @returns AuthCheckResult if authenticated, null if not authenticated (401/403), throws on errors
 * @throws Error for network errors, 500s, or other critical failures
 */
export async function checkAuth(config?: AuthUrlConfig): Promise<AuthCheckResult | null> {
    const authApiUrl = getAuthApiUrl(config);
    
    if (!authApiUrl) {
        throw new Error('Auth API URL not configured. Check VITE_AUTH_API_URL environment variable.');
    }
    
    // Step 1: Get customerId and isSuperAdmin from /auth/me
    let authResponse: Response;
    try {
        authResponse = await fetch(`${authApiUrl}/auth/me`, {
            method: 'GET',
            credentials: 'include', // Send HttpOnly cookies
            cache: 'no-store',
        });
    } catch (networkError) {
        // Network errors are critical - fail fast
        const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
        throw new Error(`Network error checking authentication: ${errorMessage}. Check your connection and that the auth service is running at ${authApiUrl}.`);
    }
    
    // 401/403 means not authenticated - this is expected, return null
    if (authResponse.status === 401 || authResponse.status === 403) {
        return null;
    }
    
    // Other non-OK statuses are errors - fail fast
    if (!authResponse.ok) {
        const errorText = await authResponse.text().catch(() => 'Unknown error');
        throw new Error(`Auth service returned error ${authResponse.status}: ${errorText}. Check auth service configuration.`);
    }
    
    let authData: { customerId?: string; isSuperAdmin?: boolean; [key: string]: any };
    try {
        authData = await authResponse.json();
    } catch (parseError) {
        throw new Error(`Failed to parse auth response: ${parseError instanceof Error ? parseError.message : String(parseError)}. Auth service may be misconfigured.`);
    }
    
    const customerId = authData.customerId;
    const isSuperAdmin = authData.isSuperAdmin || false;
    
    if (!customerId) {
        // No customerId means not authenticated
        return null;
    }
    
    // Step 2: Fetch displayName from Customer API (non-critical - we can proceed without it)
    let displayName: string | null = null;
    try {
        const customerApiUrl = getCustomerApiUrl(config);
        
        if (!customerApiUrl) {
            console.warn('[Auth] Customer API URL not configured - displayName will not be available');
        } else {
            const customerResponse = await fetch(`${customerApiUrl}/customer/me`, {
                method: 'GET',
                credentials: 'include', // Send HttpOnly cookies
                cache: 'no-store',
            });
            
            if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                displayName = customerData.displayName || null;
            } else if (customerResponse.status !== 401 && customerResponse.status !== 403) {
                // Only warn on non-auth errors (401/403 are expected if not authenticated)
                console.warn(`[Auth] Customer API returned ${customerResponse.status} - displayName will not be available`);
            }
        }
    } catch (customerError) {
        // Customer API failure is non-critical - we can proceed without displayName
        console.warn('[Auth] Failed to fetch displayName from Customer API (non-critical):', 
            customerError instanceof Error ? customerError.message : String(customerError));
    }
    
    return {
        customerId,
        displayName,
        isSuperAdmin,
    };
}
