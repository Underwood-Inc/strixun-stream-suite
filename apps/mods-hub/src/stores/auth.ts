/**
 * Auth store using shared @strixun/auth-store package
 * Uses getDefaultAuthConfig for consistent URL resolution across all apps
 */

import { createAuthStore } from '@strixun/auth-store/zustand';
import { getDefaultAuthConfig } from '@strixun/auth-store/core';

export const useAuthStore = createAuthStore(getDefaultAuthConfig());

// Re-export types for convenience
export type { AuthenticatedCustomer, AuthState, AuthStore } from '@strixun/auth-store/core';
