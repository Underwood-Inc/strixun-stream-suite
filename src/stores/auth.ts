/**
 * Authentication Store - HttpOnly Cookie SSO
 * 
 * Manages customer authentication state using HttpOnly cookies for true Single Sign-On
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists
 */

import type { Readable, Writable } from 'svelte/store';
import { derived, get, writable } from 'svelte/store';
import type { AuthenticatedCustomer } from '@strixun/auth-store';
import { secureFetch } from '../core/services/encryption';
import { fetchCustomerInfo, decodeJWTPayload, getAuthApiUrl } from '@strixun/auth-store/core/api';
import { getCookie, deleteCookie } from '@strixun/auth-store/core/utils';
import { storage } from '../modules/storage';

export interface TwitchAccount {
  twitchUserId: string;
  twitchUsername: string;
  displayName?: string;
  attachedAt: string;
}

// Re-export AuthenticatedCustomer for backward compatibility
export type { AuthenticatedCustomer };

// Store for authentication state
export const isAuthenticated: Writable<boolean> = writable(false);
export const customer: Writable<AuthenticatedCustomer | null> = writable(null);
export const csrfToken: Writable<string | null> = writable(null);
export const isSuperAdmin: Writable<boolean> = writable(false);
// NOTE: No token store - token is in HttpOnly cookie and CANNOT be read by JavaScript

// Encryption enabled flag is owned by the encryption service.
// This store exists for UI convenience (reactive gating), and is set during bootstrap.
export const encryptionEnabled: Writable<boolean> = writable(false);

// Store to track if auth check has completed
// Starts as false - we show auth screen by default until we know auth state
export const authCheckComplete: Writable<boolean> = writable(false);

// Derived store for checking if token is expired
export const isTokenExpired: Readable<boolean> = derived(
  customer,
  ($customer) => {
    if (!$customer) return true;
    return new Date($customer.expiresAt) < new Date();
  }
);

// Derived store for checking if authentication is required
// CRITICAL: Default to true (show auth screen) until auth check completes
// This prevents flash of app content before auth state is determined
// Auth is required if:
// 1. Auth check hasn't completed yet (default to showing auth screen), OR
// 2. Encryption is enabled but customer is not authenticated
export const authRequired: Readable<boolean> = derived(
  [encryptionEnabled, isAuthenticated, authCheckComplete],
  ([$encryptionEnabled, $isAuthenticated, $authCheckComplete]) => {
    // If auth check hasn't completed, show auth screen by default (secure default)
    if (!$authCheckComplete) {
      return true;
    }
    // After check completes, auth is required if encryption enabled but not authenticated
    return $encryptionEnabled && !$isAuthenticated;
  }
);

/**
 * Save authentication state - DO NOT persist token to localStorage
 * Token is stored in HttpOnly cookie on the server side for security
 * 
 * CRITICAL: Uses queueMicrotask to ensure store updates trigger reactive components
 * This fixes reactivity issues where components don't update until a manual re-render
 */
function saveAuthState(customerData: AuthenticatedCustomer | null): void {
  if (customerData) {
    // DO NOT store token in localStorage - it's in the HttpOnly cookie
    // Only store non-sensitive customer info for UX (displayName, etc.)
    const customerDataForStorage = {
      customerId: customerData.customerId,
      email: customerData.email,
      displayName: customerData.displayName,
      expiresAt: customerData.expiresAt,
      isSuperAdmin: customerData.isSuperAdmin,
      // Explicitly DO NOT store token
    };
    storage.set('auth_customer_info', customerDataForStorage);
    
    // Clean up old storage keys
    storage.remove('auth_customer');
    storage.remove('auth_user');
    storage.remove('auth_token');
    
    // Extract CSRF token and isSuperAdmin from /auth/me response data
    // CRITICAL: With HttpOnly cookies, JWT is inaccessible to JavaScript
    // CSRF token and isSuperAdmin are now included in /auth/me response
    const csrf = (customerData as any).csrf as string | undefined;
    const isSuperAdminFromResponse = customerData.isSuperAdmin === true;
    
    // Update customerData with isSuperAdmin from response if not already set
    const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdminFromResponse || customerData.isSuperAdmin };
    
    // CRITICAL: Update stores immediately first (for synchronous reads)
    isAuthenticated.set(true);
    customer.set(updatedCustomerData);
    csrfToken.set(csrf || null);
    isSuperAdmin.set(customerData.isSuperAdmin || false);
    
    // CRITICAL: Then use queueMicrotask to trigger another update cycle
    // This ensures Svelte components that mounted during initialization get the updates
    // Without this, components may not re-render until something else triggers it
    queueMicrotask(() => {
      isAuthenticated.set(true);
      customer.set(updatedCustomerData);
      csrfToken.set(csrf || null);
      isSuperAdmin.set(customerData.isSuperAdmin || false);
    });
  } else {
    // Clean up all storage keys
    storage.remove('auth_customer_info');
    storage.remove('auth_customer');
    storage.remove('auth_user');
    storage.remove('auth_token');
    
    // CRITICAL: Update stores immediately first (for synchronous reads)
    isAuthenticated.set(false);
    customer.set(null);
    csrfToken.set(null);
    isSuperAdmin.set(false);
    
    // CRITICAL: Then use queueMicrotask to trigger another update cycle
    queueMicrotask(() => {
      isAuthenticated.set(false);
      customer.set(null);
      csrfToken.set(null);
      isSuperAdmin.set(false);
    });
  }
}

/**
 * Get OTP Auth API URL
 * CRITICAL: Stream Suite must NOT depend on OTP auth service worker packages for URL resolution.
 * Use the auth-store helper (which resolves /auth-api on localhost).
 */
function getOtpAuthApiUrl(): string {
  if (typeof window === 'undefined') return '';
  return getAuthApiUrl();
}

/**
 * Decode JWT payload (without verification - for extracting CSRF token and other claims)
 */
function decodeJWTPayloadLocal(jwt: string): { csrf?: string; isSuperAdmin?: boolean; [key: string]: unknown } | null {
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

/**
 * Check authentication status from HttpOnly cookie
 * CRITICAL: HttpOnly cookies are NOT accessible from JavaScript!
 * We call /auth/me which automatically sends the cookie, and if it returns customer data, we're authenticated
 * 
 * This replaces IP-based session restoration with true SSO via cookies
 */
/**
 * Check authentication from HttpOnly cookie
 * FAIL-FAST: Throws errors for network issues, returns false only for "not authenticated"
 */
async function checkAuthFromCookie(): Promise<boolean> {
  const apiUrl = getOtpAuthApiUrl();
  if (!apiUrl) {
    throw new Error('[Auth] OTP Auth API URL not configured. Check VITE_AUTH_API_URL environment variable.');
  }

  try {
    // Fetch customer info from /auth/me - cookie is sent automatically by browser
    // If the HttpOnly cookie is valid, this will return customer data
    const customerInfo = await fetchCustomerInfo(null, { authApiUrl: apiUrl });
    
    if (customerInfo) {
      // We don't have direct access to the JWT token (it's HttpOnly)
      // But we can create a customer object with the info we got from /auth/me
      const authenticatedCustomer: AuthenticatedCustomer = {
        customerId: customerInfo.customerId,
        email: customerInfo.email || '',
        displayName: customerInfo.displayName || undefined,
        token: '', // Token is in HttpOnly cookie, not accessible from JS
        expiresAt: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(), // Default 7 hours
        isSuperAdmin: customerInfo.isSuperAdmin || false,
      };
      
      saveAuthState(authenticatedCustomer);
      console.log('[Auth] Session restored from HttpOnly cookie', {
        customerId: authenticatedCustomer.customerId,
        hasDisplayName: Boolean(authenticatedCustomer.displayName),
        isSuperAdmin: authenticatedCustomer.isSuperAdmin,
        authApiUrl: apiUrl,
      });
      return true;
    } else {
      // No customer data returned - not authenticated (401/403) - this is expected
      console.debug('[Auth] No customer data from /auth/me - not authenticated', { authApiUrl: apiUrl });
      saveAuthState(null);
      return false;
    }
  } catch (error) {
    // Network errors, 500s, etc. are critical - log and rethrow for caller to handle
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Auth] Error during checkAuth:', errorMessage);
    saveAuthState(null);
    
    // Re-throw so caller can handle it (fail-fast)
    throw new Error(`Authentication check failed: ${errorMessage}. Check your connection and that the auth service is running.`);
  }
}

/**
 * Load authentication state from HttpOnly cookie
 * Checks for auth token in cookie and validates with backend
 * 
 * CRITICAL: This is the new cookie-based SSO approach - no localStorage token storage
 */
export async function loadAuthState(): Promise<void> {
  try {
    // Clean up old storage keys (migration)
    storage.remove('auth_customer');
    storage.remove('auth_user');
    storage.remove('auth_token');
    
    // Check authentication from HttpOnly cookie
    await checkAuthFromCookie();
  } catch (error) {
    console.error('[Auth] Failed to load auth state:', error);
    saveAuthState(null);
  } finally {
    // Mark auth check as complete
    authCheckComplete.set(true);
  }
}

/**
 * Set authentication state (after login)
 * CRITICAL: Token is now in HttpOnly cookie, we just update the store
 */
export function setAuth(customerData: AuthenticatedCustomer): void {
  saveAuthState(customerData);
}

/**
 * Login with token (after successful OTP verification)
 * CRITICAL: Token is in HttpOnly cookie, we fetch full customer data from /auth/me
 */
export async function login(jwtToken: string): Promise<void> {
  // Decode token to get basic customer info
  const payload = decodeJWTPayloadLocal(jwtToken);
  if (!payload) {
    console.error('[Auth] Failed to decode JWT token');
    return;
  }
  
  // Immediately set basic auth state from JWT
  const basicCustomerData: AuthenticatedCustomer = {
    customerId: payload.customerId as string || payload.sub as string,
    email: payload.email as string,
    displayName: payload.displayName as string | undefined,
    token: '', // Token is in HttpOnly cookie
    expiresAt: payload.exp ? new Date(payload.exp as number * 1000).toISOString() : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    isSuperAdmin: payload.isSuperAdmin as boolean || false,
  };
  
  saveAuthState(basicCustomerData);
  
  // Then fetch full customer data from /auth/me (which uses the HttpOnly cookie)
  try {
    await checkAuthFromCookie();
  } catch (error) {
    console.warn('[Auth] Failed to fetch full customer data after login:', error);
    // Keep the basic data we decoded from JWT
  }
}

/**
 * Check authentication status
 * Wrapper for loadAuthState for consistency with other apps
 */
export async function checkAuth(): Promise<boolean> {
  try {
    await loadAuthState();
    return get(isAuthenticated);
  } catch (error) {
    console.error('[Auth] checkAuth failed:', error);
    return false;
  }
}

/**
 * Clear authentication state (logout)
 */
export function clearAuth(): void {
  saveAuthState(null);
}

/**
 * Logout customer - calls API endpoint to clear HttpOnly cookie and clears local auth state
 * Continues with logout even if API call fails (graceful degradation)
 */
export async function logout(): Promise<void> {
  try {
    const apiUrl = getOtpAuthApiUrl();
    if (!apiUrl) {
      console.warn('[Auth] OTP Auth API URL not configured, clearing local state only');
      clearAuth();
      return;
    }

    // Call logout endpoint to clear HttpOnly cookie
    const response = await secureFetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: send cookies
    });

    if (!response.ok) {
      console.warn('[Auth] Logout API call failed:', response.status);
    }
  } catch (error) {
    // Continue with logout even if API call fails
    // This ensures customer can always logout locally
    console.warn('[Auth] Logout API call failed, continuing with local logout:', error);
  } finally {
    // Always clear local auth state
    clearAuth();
    // HttpOnly cookie is cleared by the server, we can't delete it from JavaScript
  }
}

// getAuthToken() REMOVED: HttpOnly cookies cannot be read by JavaScript.
// The browser automatically sends the cookie with credentials: 'include'.
// Use isAuthenticated store to check authentication status.

/**
 * Get current CSRF token from JWT payload
 */
export function getCsrfToken(): string | null {
  return get(csrfToken);
}

/**
 * Get API base URL from config
 */
export function getApiUrl(): string {
  // Try to get from window config (injected during build)
  if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
    return (window as any).getWorkerApiUrl() || '';
  }
  return '';
}

/**
 * Make authenticated API request
 * CRITICAL: Uses credentials: 'include' to send HttpOnly cookies
 * 
 * With HttpOnly cookies, we cannot read the token from JavaScript.
 * The browser automatically sends the auth_token cookie with credentials: 'include'.
 * We just need to ensure the user is authenticated (check store state).
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check if user is authenticated (from store state, not cookie)
  if (!get(isAuthenticated)) {
    throw new Error('Not authenticated');
  }
  
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error('API URL not configured');
  }
  
  const headers = new Headers(options.headers);
  // NOTE: Do NOT add Authorization header - token is in HttpOnly cookie
  // The browser sends it automatically with credentials: 'include'
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
  // CRITICAL: Include credentials to send HttpOnly cookies automatically
  return secureFetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
}

