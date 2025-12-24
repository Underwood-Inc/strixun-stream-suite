/**
 * Authentication Store
 * 
 * Manages user authentication state and token
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { storage } from '../modules/storage';
import { secureFetch } from '../core/services/encryption';

export interface User {
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
}

// Store for authentication state
export const isAuthenticated: Writable<boolean> = writable(false);
export const user: Writable<User | null> = writable(null);
export const token: Writable<string | null> = writable(null);
export const csrfToken: Writable<string | null> = writable(null);

// Store for encryption enabled state (set by bootstrap)
export const encryptionEnabled: Writable<boolean> = writable(false);

// Derived store for checking if token is expired
export const isTokenExpired: Readable<boolean> = derived(
  user,
  ($user) => {
    if (!$user) return true;
    return new Date($user.expiresAt) < new Date();
  }
);

// Derived store for checking if authentication is required
// Auth is required if encryption is enabled but user is not authenticated
export const authRequired: Readable<boolean> = derived(
  [encryptionEnabled, isAuthenticated],
  ([$encryptionEnabled, $isAuthenticated]) => {
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

