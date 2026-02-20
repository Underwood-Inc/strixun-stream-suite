/**
 * Shared auth config for all apps
 * Single source of truth - no duplicate URL resolution per app
 *
 * Use this in mods-hub, chat-hub, url-shortener, etc.
 */

import { getAuthApiUrl } from './api';
import type { AuthStoreConfig } from './types';

/**
 * Standard auth config for apps using auth-store
 * Resolves: /auth-api (dev) | auth.idling.app (prod) | VITE_AUTH_API_URL override
 */
export function getDefaultAuthConfig(): AuthStoreConfig {
  return {
    authApiUrl: getAuthApiUrl(),
  };
}
