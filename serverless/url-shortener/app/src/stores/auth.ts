/**
 * Auth store using shared @strixun/auth-store package
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl, getDefaultAuthConfig } from '@strixun/auth-store/core';

function isShortArmyHost(hostname: string): boolean {
  return hostname === 'short.army' || hostname.endsWith('.short.army');
}

/**
 * OTP login URL only (not checkAuth).
 * short.army uses same-origin /auth-api so verify-otp can set HttpOnly cookies on .short.army + .idling.app.
 */
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

/** checkAuth/logout/refresh → auth.idling.app in prod (SSO path that worked before list routing changes). */
export const useAuthStore = createAuthStore(getDefaultAuthConfig());

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';