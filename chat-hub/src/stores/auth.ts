/**
 * Auth store using shared @strixun/auth-store package
 * This is a thin wrapper that exports the Zustand store for chat-hub
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage token storage
 * - Cookies handle everything (SSO across all *.idling.app domains)
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
});

// Re-export types for convenience
export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';
