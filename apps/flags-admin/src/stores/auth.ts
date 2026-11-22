/**
 * Auth store using shared @strixun/auth-store package
 * (same pattern as mods-hub, chat-hub)
 */
import { createAuthStore } from '@strixun/auth-store/zustand';
import { getAuthApiUrl, getDefaultAuthConfig } from '@strixun/auth-store/core';

export const flagsAdminAuthConfig = getDefaultAuthConfig();

export const useAuthStore = createAuthStore(flagsAdminAuthConfig);

/** OTP login + checkAuth base URL (same-origin /auth-api in production builds). */
export function getFlagsAdminAuthApiUrl(): string {
  return getAuthApiUrl(flagsAdminAuthConfig);
}

export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';