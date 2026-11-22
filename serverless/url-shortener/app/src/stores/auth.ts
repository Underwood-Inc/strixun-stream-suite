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

const IDLING_AUTH_ORIGIN = 'https://auth.idling.app';

export function isShortArmyBrowserHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const hostname = window.location.hostname;
  return hostname === 'short.army' || hostname.endsWith('.short.army');
}

/**
 * When the user is signed in on *.idling.app, mint host-scoped cookies for short.army
 * without a second OTP. Uses a short-lived opaque bridge code (never stored in localStorage).
 */
export async function bootstrapShortArmySessionFromIdling(): Promise<boolean> {
  if (!isShortArmyBrowserHost()) {
    return false;
  }

  const issueRes = await fetch(`${IDLING_AUTH_ORIGIN}/auth/session/bridge-code`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target_host: 'short.army' }),
  });

  if (!issueRes.ok) {
    return false;
  }

  let bridgeCode: string | undefined;
  try {
    const payload = (await issueRes.json()) as { bridge_code?: string };
    bridgeCode = payload.bridge_code;
  } catch {
    return false;
  }

  if (!bridgeCode) {
    return false;
  }

  const redeemRes = await fetch(`${getShortenerAuthApiUrl()}/auth/session/from-idling`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bridge_code: bridgeCode }),
  });

  return redeemRes.ok;
}