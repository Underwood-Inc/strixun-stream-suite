/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getDefaultAuthConfig } from '@strixun/auth-store/core';
import type { AuthStoreConfig } from '@strixun/auth-store/core';

/**
 * OTP / verify-otp base on url-shortener hosts.
 *
 * Production: same-origin `/auth-api` (worker proxy) so verify-otp can set dual
 * `.idling.app` + `.short.army` cookies. Cross-origin auth.idling.app must NOT
 * be used for OTP on short.army.
 */
export function getShortenerAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  return '/auth-api';
}

/** checkAuth / logout / refresh → auth.idling.app in prod (SSO from *.idling.app). */
export const shortenerAuthConfig: AuthStoreConfig = getDefaultAuthConfig();

export const useAuthStore = createAuthStore(shortenerAuthConfig);

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';