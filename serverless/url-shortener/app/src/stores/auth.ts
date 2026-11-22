/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl } from '@strixun/auth-store/core';

/** Same-origin /auth-api on every shortener custom domain (worker proxy + forwardSetCookie). */
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

/** Pin same-origin proxy in prod and dev (Vite proxies /auth-api locally). */
export const useAuthStore = createAuthStore({ authApiUrl: '/auth-api' });

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';