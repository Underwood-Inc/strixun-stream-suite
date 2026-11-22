/**
 * Auth store using shared @strixun/auth-store package
 *
 * Production: same-origin `/auth-api` Pages proxy only (mods-hub / url-shortener pattern).
 * Do not use getDefaultAuthConfig() — it can fall back to https://auth.idling.app at module
 * init; cross-origin checkAuth then looks signed-in while PUT /flags-api returns 401.
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import type { AuthStoreConfig } from '@strixun/auth-store/core';
import { getAuthApiUrl } from '@strixun/auth-store/core';

export function getFlagsAdminAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return getAuthApiUrl();
  }
  return '/auth-api';
}

export const flagsAdminAuthConfig: AuthStoreConfig = {
  authApiUrl: getFlagsAdminAuthApiUrl(),
};

export const useAuthStore = createAuthStore(flagsAdminAuthConfig);

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';