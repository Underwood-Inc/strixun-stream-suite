/**
 * Auth store using shared @strixun/auth-store package
 * This is a thin wrapper that exports the Zustand store for mods-hub
 */

import { createAuthStore } from '@strixun/auth-store/zustand';

// Use proxy in development (via Vite), direct URL in production
// E2E tests can override with VITE_AUTH_API_URL to use direct local worker URLs
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
  ? import.meta.env.VITE_AUTH_API_URL  // Explicit URL override (for E2E tests)
  : (import.meta.env.DEV 
    ? '/auth-api'  // Vite proxy in development
    : 'https://auth.idling.app');  // Production default

// Create and export the auth store
export const useAuthStore = createAuthStore({
    authApiUrl: AUTH_API_URL,
    storageKey: 'auth-storage',
    enableSessionRestore: true,
    enableTokenValidation: true,
    sessionRestoreTimeout: 10000,
    tokenValidationTimeout: 5000,
});

// Re-export types for convenience
export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';
