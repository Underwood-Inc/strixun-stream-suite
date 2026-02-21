/**
 * Authentication Store - HttpOnly Cookie SSO
 *
 * Uses shared @strixun/auth-store Svelte adapter so OIDC/OTP session refresh
 * (reactive 401→refresh + optional proactive refresh) matches mods-hub, chat-hub, url-shortener.
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists.
 */

import { get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';
import { createAuthStore } from '@strixun/auth-store/svelte';
import { getDefaultAuthConfig } from '@strixun/auth-store/core';
import { refreshAuth } from '@strixun/auth-store/core/api';
import type { AuthenticatedCustomer } from '@strixun/auth-store/core';
import { secureFetch } from '../core/services/encryption';
import { storage } from '../modules/storage';

export interface TwitchAccount {
  twitchUserId: string;
  twitchUsername: string;
  displayName?: string;
  attachedAt: string;
}

export type { AuthenticatedCustomer };

const authStore = createAuthStore(getDefaultAuthConfig());

// Re-export package stores so existing imports keep working
export const isAuthenticated = authStore.isAuthenticated;
export const customer = authStore.customer;
export const csrfToken = authStore.csrfToken;
export const isSuperAdmin = authStore.isSuperAdmin;
export const isTokenExpired = authStore.isTokenExpired;

// App-specific: encryption and auth-check gating (not in auth-store package)
export const encryptionEnabled: Writable<boolean> = writable(false);
export const authCheckComplete: Writable<boolean> = writable(false);

export const authRequired: Readable<boolean> = derived(
  [encryptionEnabled, isAuthenticated, authCheckComplete],
  ([$encryptionEnabled, $isAuthenticated, $authCheckComplete]) => {
    if (!$authCheckComplete) return true;
    return $encryptionEnabled && !$isAuthenticated;
  }
);

/**
 * Load authentication state from HttpOnly cookie.
 * Uses package checkAuth (includes silent refresh when access token expired).
 */
export async function loadAuthState(): Promise<void> {
  try {
    storage.remove('auth_customer');
    storage.remove('auth_user');
    storage.remove('auth_token');
    storage.remove('auth_customer_info');
    await authStore.loadAuthState();
  } catch (error) {
    console.error('[Auth] Failed to load auth state:', error);
    authStore.setCustomer(null);
  } finally {
    authCheckComplete.set(true);
  }
}

/** Set authentication state (e.g. after Twitch attach). */
export function setAuth(customerData: AuthenticatedCustomer): void {
  authStore.setCustomer(customerData);
}

/** Login with JWT after OTP verification; then sync with /auth/me. */
export async function login(jwtToken: string): Promise<void> {
  authStore.login(jwtToken);
  try {
    await authStore.checkAuth();
  } catch (error) {
    console.warn('[Auth] Failed to fetch full customer data after login:', error);
  }
}

/** Check authentication status (uses package: /auth/me + silent refresh on expiry). */
export async function checkAuth(): Promise<boolean> {
  try {
    const ok = await authStore.checkAuth();
    return ok;
  } catch (error) {
    console.error('[Auth] checkAuth failed:', error);
    return false;
  }
}

/** Clear local auth state only (no API call). */
export function clearAuth(): void {
  authStore.setCustomer(null);
}

/**
 * Try to refresh the session (exchange refresh_token for new access token).
 * Use this on 401 before redirecting to login — if true, retry the request; if false, session is dead.
 */
export async function tryRefreshSession(): Promise<boolean> {
  return refreshAuth(getDefaultAuthConfig());
}

/** Logout: call /auth/logout and clear local state. */
export async function logout(): Promise<void> {
  await authStore.logout();
}

export function getCsrfToken(): string | null {
  return authStore.getCsrfToken();
}

/**
 * Get API base URL from app config (window.getWorkerApiUrl).
 * Not part of auth-store; specific to this app.
 */
export function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as unknown as { getWorkerApiUrl?: () => string }).getWorkerApiUrl) {
    return (window as unknown as { getWorkerApiUrl: () => string }).getWorkerApiUrl() || '';
  }
  return '';
}

/**
 * Authenticated API request. Uses credentials: 'include' so HttpOnly cookie is sent.
 * On 401, tries refresh once and retries the request; only throws if refresh fails.
 */
export async function authenticatedFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (!get(isAuthenticated)) {
    throw new Error('Not authenticated');
  }
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error('API URL not configured');
  }
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const method = options.method || 'GET';
  if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }
  let response = await secureFetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await secureFetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }
  return response;
}
