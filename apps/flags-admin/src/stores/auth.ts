/**
 * Auth store using shared @strixun/auth-store package
 * (same pattern as mods-hub, chat-hub, url-shortener app)
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl } from '@strixun/auth-store/core';

/** Production uses same-origin /auth-api Pages proxy (mods-hub pattern). */
export function getFlagsAdminAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return getAuthApiUrl();
  }
  return '/auth-api';
}

export const flagsAdminAuthConfig = { authApiUrl: getFlagsAdminAuthApiUrl() } as const;

export const useAuthStore = createAuthStore(flagsAdminAuthConfig);

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';