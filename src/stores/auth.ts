/**
 * Authentication Store
 * 
 * Manages customer authentication state and token
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists
 */

import type { Readable, Writable } from 'svelte/store';
import { derived, get, writable } from 'svelte/store';
import type { AuthenticatedCustomer } from '@strixun/auth-store';
import { secureFetch } from '../core/services/encryption';
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
export const token: Writable<string | null> = writable(null);
export const csrfToken: Writable<string | null> = writable(null);

// Store for encryption enabled state (set by bootstrap)
// Default to true since encryption is enabled by default (secure default)
export const encryptionEnabled: Writable<boolean> = writable(true);

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
 * Save authentication state to storage
 * Stores everything in regular storage for persistence across reloads
 */
function saveAuthState(customerData: AuthenticatedCustomer | null): void {
  if (customerData) {
    // Store customer data in regular storage (for persistence across reloads)
    // Token is included in customerData, so no need for separate token storage
    storage.set('auth_customer', customerData);
    // Clean up old auth_user storage key
    storage.remove('auth_user');
    
    // Extract CSRF token and isSuperAdmin from JWT payload
    const payload = decodeJWTPayload(customerData.token);
    const csrf = payload?.csrf as string | undefined;
    const isSuperAdmin = payload?.isSuperAdmin === true;
    
    // Update customerData with isSuperAdmin from JWT if not already set
    const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdmin || customerData.isSuperAdmin };
    
    isAuthenticated.set(true);
    customer.set(updatedCustomerData);
    token.set(customerData.token);
    csrfToken.set(csrf || null);
  } else {
    storage.remove('auth_customer');
    storage.remove('auth_user'); // Clean up any old storage key (legacy)
    storage.remove('auth_token'); // Clean up any old token storage
    isAuthenticated.set(false);
    customer.set(null);
    token.set(null);
    csrfToken.set(null);
  }
}

/**
 * Get OTP Auth API URL
 */
function getOtpAuthApiUrl(): string {
  // Try to get from window config (injected during build)
  if (typeof window !== 'undefined') {
    // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        import.meta.env?.DEV ||
                        import.meta.env?.MODE === 'development';
    
    if (isLocalhost) {
      // NEVER fall back to production when on localhost
      return 'http://localhost:8787';
    }
    
    // Priority 1: VITE_AUTH_API_URL (for E2E tests, set by playwright config)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
      const viteUrl = import.meta.env.VITE_AUTH_API_URL;
      if (viteUrl) {
        return viteUrl;
      }
    }
    
    // Priority 2: window.getOtpAuthApiUrl() (from config.js)
    if ((window as any).getOtpAuthApiUrl) {
      const url = (window as any).getOtpAuthApiUrl();
      if (url) {
        return url;
      }
    }
    
    // Only use production URL if NOT on localhost
    return 'https://auth.idling.app';
  }
  return '';
}

/**
 * Restore session from backend based on IP address
 * This enables cross-application session sharing for the same device
 * 
 * CRITICAL: Has timeout to prevent browser lockup if server is slow/unresponsive
 */
async function restoreSessionFromBackend(): Promise<boolean> {
  try {
    const apiUrl = getOtpAuthApiUrl();
    if (!apiUrl) {
      console.warn('[Auth] OTP Auth API URL not configured, skipping session restoration');
      return false;
    }

    // Add timeout to prevent browser lockup (5 seconds max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // 5 second timeout

    let response: Response;
    try {
      response = await secureFetch(`${apiUrl}/auth/restore-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // If aborted, it's a timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[Auth] Session restoration timed out after 5 seconds');
        return false;
      }
      throw fetchError; // Re-throw other errors
    }

    if (!response.ok) {
      // Not an error - just no session found
      if (response.status === 200) {
        const data = await response.json() as { restored?: boolean };
        if (!data.restored) {
          return false;
        }
      } else {
        console.warn('[Auth] Session restoration failed:', response.status);
        return false;
      }
    }

    const data = await response.json() as {
      restored?: boolean;
      access_token?: string;
      token?: string;
      sub?: string;
      email?: string;
      displayName?: string | null;
      customerId: string;
      expiresAt?: string;
      isSuperAdmin?: boolean;
    };
    
    if (data.restored && data.access_token) {
      // Session restored! Save the token
      const customerData: AuthenticatedCustomer = {
        customerId: data.customerId,
        email: data.email || '',
        displayName: data.displayName || undefined,
        token: data.access_token || data.token || '',
        expiresAt: data.expiresAt || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
        isSuperAdmin: data.isSuperAdmin || false,
      };
      
      saveAuthState(customerData);
      console.log('[Auth] ✓ Session restored from backend for customer:', customerData.email);
      return true;
    }

    if (data.restored === false) {
      console.log('[Auth] No active session found for this IP address');
    } else {
      console.warn('[Auth] Unexpected response format from restore-session:', { restored: data.restored, hasToken: !!data.access_token });
    }

    return false;
  } catch (error) {
    // Log error for debugging (session restoration is optional but we want to know if it's failing)
    console.warn('[Auth] Session restoration error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.debug('[Auth] Session restoration stack:', error.stack);
    }
    return false;
  }
}

/**
 * Validate token with backend to check if it's blacklisted or invalid
 * Returns true if token is valid, false if invalid/blacklisted
 * 
 * Uses OTP Auth API URL to ensure we're validating against the same auth service
 * that handles logout and token blacklisting
 */
async function validateTokenWithBackend(token: string): Promise<boolean> {
  try {
    const apiUrl = getOtpAuthApiUrl();
    if (!apiUrl) {
      // If no API URL configured, skip validation (graceful degradation)
      return true;
    }

    // Add timeout to prevent blocking initialization (2 seconds max)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 2000); // 2 second timeout

    try {
      const response = await secureFetch(`${apiUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // If 401, token is invalid/blacklisted
      if (response.status === 401) {
        console.log('[Auth] Token validation failed: token is invalid or blacklisted');
        return false;
      }

      // If 200, token is valid
      if (response.ok) {
        return true;
      }

      // Other status codes - assume valid to avoid clearing auth on server errors
      console.warn('[Auth] Token validation returned unexpected status:', response.status, '- assuming valid');
      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // If aborted, it's a timeout - assume valid to avoid blocking initialization
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('[Auth] Token validation timed out, assuming valid to avoid blocking initialization');
        return true;
      }
      // Other errors (network issues, etc.) - assume valid to avoid clearing auth on temporary issues
      console.warn('[Auth] Token validation error (assuming valid to avoid clearing auth):', fetchError);
      return true;
    }
  } catch (error) {
    // Silently fail - don't block initialization if validation fails
    console.debug('[Auth] Token validation error (non-critical):', error);
    return true; // Assume valid to avoid blocking initialization
  }
}

/**
 * Load authentication state from storage
 * Loads token from sessionStorage (more secure)
 * If no token found, attempts to restore session from backend (cross-domain session sharing)
 * 
 * CRITICAL: Validates tokens with backend to detect blacklisted tokens from logout on other domains
 */
export async function loadAuthState(): Promise<void> {
  try {
    // Try new storage key first, fallback to old key for migration
    let customerData = storage.get('auth_customer') as AuthenticatedCustomer | null;
    if (!customerData) {
      // Migrate from old auth_user storage key
      const oldUserData = storage.get('auth_user') as any;
      if (oldUserData) {
        customerData = {
          customerId: oldUserData.customerId || oldUserData.userId || oldUserData.sub || '',
          email: oldUserData.email,
          displayName: oldUserData.displayName,
          token: oldUserData.token,
          expiresAt: oldUserData.expiresAt,
          isSuperAdmin: oldUserData.isSuperAdmin,
        };
        // Save under new key and remove old key
        storage.set('auth_customer', customerData);
        storage.remove('auth_user');
      }
    }
    
    // Token is stored in customerData, no need to check separate token storage
    if (customerData && customerData.token && 'expiresAt' in customerData && typeof customerData.expiresAt === 'string') {
      // Check if token is expired locally first (fast check)
      if (new Date(customerData.expiresAt) > new Date()) {
        // Token not expired locally - validate with backend to check if blacklisted
        // This ensures we detect tokens that were blacklisted on other domains
        // BUT: Don't clear auth on network errors - only clear if explicitly invalid
        const isValid = await validateTokenWithBackend(customerData.token);
        
        if (!isValid) {
          // Token is blacklisted or invalid - clear auth state
          console.log('[Auth] Token is blacklisted or invalid, clearing auth state');
          saveAuthState(null);
          // Try to restore session from backend (in case there's a valid session for this IP)
          await restoreSessionFromBackend();
          return;
        }

        // Token is valid - restore auth state
        // Extract CSRF token and isSuperAdmin from JWT payload before saving
        const payload = decodeJWTPayload(customerData.token);
        const csrf = payload?.csrf as string | undefined;
        const isSuperAdmin = payload?.isSuperAdmin === true;
        if (csrf) {
          csrfToken.set(csrf);
        }
        // Update customerData with isSuperAdmin from JWT if not already set
        const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdmin || customerData.isSuperAdmin };
        saveAuthState(updatedCustomerData);
        console.log('[Auth] ✓ Customer authenticated from storage, token valid until:', customerData.expiresAt);
        return;
      } else {
        // Token expired, try to restore from backend before clearing
        console.log('[Auth] Token expired, attempting to restore from backend');
        const restored = await restoreSessionFromBackend();
        if (!restored) {
          // Backend restore failed, clear auth
          saveAuthState(null);
        }
        return;
      }
    }

    // No customerData found - try to restore session from backend
    // This enables cross-application session sharing for the same device/IP
    if (!customerData) {
      await restoreSessionFromBackend();
    }
  } catch (error) {
    console.error('[Auth] Failed to load auth state:', error);
    // Don't clear auth on error - might be a temporary network issue
    // Only clear if we truly have no customerData
    const customerData = storage.get('auth_customer') as AuthenticatedCustomer | null;
    if (!customerData) {
      saveAuthState(null);
    }
  }
}

/**
 * Set authentication state (after login)
 */
export function setAuth(customerData: AuthenticatedCustomer): void {
  saveAuthState(customerData);
}

/**
 * Clear authentication state (logout)
 */
export function clearAuth(): void {
  saveAuthState(null);
}

/**
 * Logout customer - calls API endpoint and clears local auth state
 * Continues with logout even if API call fails (graceful degradation)
 */
export async function logout(): Promise<void> {
  try {
    // Try to call logout endpoint to invalidate token on server
    await authenticatedFetch('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    // Continue with logout even if API call fails
    // This ensures customer can always logout locally
    console.warn('[Auth] Logout API call failed, continuing with local logout:', error);
  } finally {
    // Always clear local auth state
    clearAuth();
  }
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
  return get(token);
}

/**
 * Get current CSRF token from JWT payload
 */
export function getCsrfToken(): string | null {
  return get(csrfToken);
}

/**
 * Decode JWT payload (without verification - for extracting CSRF token)
 */
function decodeJWTPayload(jwt: string): { csrf?: string; [key: string]: unknown } | null {
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

