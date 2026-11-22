/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import type { AuthStoreConfig } from '@strixun/auth-store/core';

/**
 * OTP / verify-otp base on url-shortener hosts.
 *
 * Production: same-origin `/auth-api` (worker proxy). Proxy forwards only
 * Set-Cookie for the requester domain (.short.army or .idling.app). Do not use
 * cross-origin auth.idling.app for checkAuth on shortener hosts.
 */
export function getShortenerAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  return '/auth-api';
}

/** OTP, checkAuth, logout, refresh — all via same-origin `/auth-api` proxy. */
export const shortenerAuthConfig: AuthStoreConfig = {
  authApiUrl: getShortenerAuthApiUrl(),
};

export const useAuthStore = createAuthStore(shortenerAuthConfig);

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';