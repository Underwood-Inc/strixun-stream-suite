/**
 * Authentication Store
 * 
 * Manages user authentication state and token
 */

import { writable, derived, get } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';
import { storage } from '../modules/storage';

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

// Derived store for checking if token is expired
export const isTokenExpired: Readable<boolean> = derived(
  user,
  ($user) => {
    if (!$user) return true;
    return new Date($user.expiresAt) < new Date();
  }
);

/**
 * Save authentication state to storage
 */
function saveAuthState(userData: User | null): void {
  if (userData) {
    storage.set('auth_user', userData);
    storage.set('auth_token', userData.token);
    isAuthenticated.set(true);
    user.set(userData);
    token.set(userData.token);
  } else {
    storage.remove('auth_user');
    storage.remove('auth_token');
    isAuthenticated.set(false);
    user.set(null);
    token.set(null);
  }
}

/**
 * Load authentication state from storage
 */
export function loadAuthState(): void {
  try {
    const userData = storage.get<User>('auth_user');
    const savedToken = storage.getRaw('auth_token');
    
    if (userData && savedToken && typeof savedToken === 'string') {
      // Check if token is expired
      if (new Date(userData.expiresAt) > new Date()) {
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
 * Get API base URL from config
 */
function getApiUrl(): string {
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
  
  return fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });
}

