/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl } from '@strixun/auth-store/core';

function isShortArmyHost(hostname: string): boolean {
  return hostname === 'short.army' || hostname.endsWith('.short.army');
}

/** Same-origin /auth-api on short.army (worker proxy); cross-TLD idling hosts keep canonical auth URL. */
export function getShortenerAuthApiUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
    return String(import.meta.env.VITE_AUTH_API_URL);
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return getAuthApiUrl();
  }
  if (typeof window !== 'undefined' && isShortArmyHost(window.location.hostname)) {
    return '/auth-api';
  }
  return getAuthApiUrl();
}

export const useAuthStore = createAuthStore({ authApiUrl: getShortenerAuthApiUrl() });

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';