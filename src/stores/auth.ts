/**
 * Authentication Store
 * 
 * Manages user authentication state and token
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { storage } from '../modules/storage';
import { secureFetch } from '../core/services/encryption';

export interface TwitchAccount {
  twitchUserId: string;
  twitchUsername: string;
  displayName?: string;
  attachedAt: string;
}

export interface User {
  userId: string;
  email: string;
  displayName?: string; // Anonymized display name
  customerId?: string; // Customer ID for subscription tiers
  twitchAccount?: TwitchAccount; // Attached Twitch account
  token: string;
  expiresAt: string;
  isSuperAdmin?: boolean; // Super admin status
}

// Store for authentication state
export const isAuthenticated: Writable<boolean> = writable(false);
export const user: Writable<User | null> = writable(null);
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
  user,
  ($user) => {
    if (!$user) return true;
    return new Date($user.expiresAt) < new Date();
  }
);

// Derived store for checking if authentication is required
// CRITICAL: Default to true (show auth screen) until auth check completes
// This prevents flash of app content before auth state is determined
// Auth is required if:
// 1. Auth check hasn't completed yet (default to showing auth screen), OR
// 2. Encryption is enabled but user is not authenticated
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
 * Uses sessionStorage for tokens (more secure, cleared on browser close)
 */
function saveAuthState(userData: User | null): void {
  if (userData) {
    // Store user data in regular storage (for persistence)
    storage.set('auth_user', userData);
    // Store token in sessionStorage (more secure, cleared on browser close)
    // This reduces XSS attack window since tokens are cleared when browser closes
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('auth_token', userData.token);
    } else {
      // Fallback to regular storage if sessionStorage unavailable
      storage.set('auth_token', userData.token);
    }
    
    // Extract CSRF token from JWT payload
    const payload = decodeJWTPayload(userData.token);
    const csrf = payload?.csrf as string | undefined;
    
    isAuthenticated.set(true);
    user.set(userData);
    token.set(userData.token);
    csrfToken.set(csrf || null);
  } else {
    storage.remove('auth_user');
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('auth_token');
    } else {
      storage.remove('auth_token');
    }
    isAuthenticated.set(false);
    user.set(null);
    token.set(null);
    csrfToken.set(null);
  }
}

/**
 * Load authentication state from storage
 * Loads token from sessionStorage (more secure)
 */
export function loadAuthState(): void {
  try {
    const userData = storage.get<User>('auth_user');
    // Try sessionStorage first (more secure), fallback to regular storage
    let savedToken: string | null = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      savedToken = sessionStorage.getItem('auth_token');
    }
    if (!savedToken) {
      savedToken = storage.getRaw('auth_token') as string | null;
    }
    
    if (userData && savedToken && typeof savedToken === 'string') {
      // Check if token is expired
      if (new Date(userData.expiresAt) > new Date()) {
        // Update token in sessionStorage if we loaded from regular storage
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('auth_token', savedToken);
          // Remove from regular storage if it was there
          storage.remove('auth_token');
        }
        // Extract CSRF token from JWT payload before saving
        const payload = decodeJWTPayload(savedToken);
        const csrf = payload?.csrf as string | undefined;
        if (csrf) {
          csrfToken.set(csrf);
        }
        saveAuthState(userData);
      } else {
        // Token expired, clear auth
        saveAuthState(null);
      }
    } else {
      saveAuthState(null);
    }
  } catch (error) {
    console.error('[Auth] Failed to load auth state:', error);
    saveAuthState(null);
  }
}

/**
 * Set authentication state (after login)
 */
export function setAuth(userData: User): void {
  saveAuthState(userData);
}

/**
 * Clear authentication state (logout)
 */
export function clearAuth(): void {
  saveAuthState(null);
}

/**
 * Logout user - calls API endpoint and clears local auth state
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
    // This ensures user can always logout locally
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

