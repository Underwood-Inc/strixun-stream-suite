/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl } from '@strixun/auth-store/core';
import type { AuthStoreConfig } from '@strixun/auth-store/core';

/**
 * Auth API base for OTP, checkAuth, logout, and refresh.
 *
 * Production url-shortener hosts (short.army, s.idling.app, …) all expose same-origin `/auth-api`
 * on the worker so verify-otp Set-Cookie reaches the registrable domain the browser will send
 * on `https://short.army/api/*` (Domain=.short.army). Cross-origin auth.idling.app must NOT be
 * used for checkAuth on short.army — `.idling.app` cookies are not sent to short.army.
 */
export function getShortenerAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return getAuthApiUrl();
  }
  if (typeof window !== 'undefined') {
    return '/auth-api';
  }
  return getAuthApiUrl();
}

/** Single config: OTP + checkAuth + logout + refresh share the same base URL. */
export const shortenerAuthConfig: AuthStoreConfig = {
  authApiUrl: getShortenerAuthApiUrl(),
};

export const useAuthStore = createAuthStore(shortenerAuthConfig);

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';