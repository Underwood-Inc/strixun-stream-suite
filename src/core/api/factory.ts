/**
 * API Framework - Factory Functions
 * 
 * Convenient factory functions for creating API clients
 */

import type { APIClientConfig } from './types';
import { EnhancedAPIClient } from './enhanced-client';
import { getAuthToken, getCsrfToken } from '../../stores/auth';

/**
 * Get API URL from config
 */
function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
    return (window as any).getWorkerApiUrl() || '';
  }
  return '';
}

/**
 * Create default API client instance
 */
export function createAPIClient(config: Partial<APIClientConfig> = {}): EnhancedAPIClient {
  const apiUrl = getApiUrl();

  const defaultConfig: APIClientConfig = {
    baseURL: apiUrl,
    timeout: 30000,
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 10000,
      retryableErrors: [408, 429, 500, 502, 503, 504],
    },
    cache: {
      enabled: false, // Disabled by default - only enable for specific requests that need caching
      defaultStrategy: 'network-only', // Never cache by default
      defaultTTL: 0, // No TTL by default
    },
    offline: {
      enabled: true,
      queueSize: 100,
      syncOnReconnect: true,
      retryOnReconnect: true,
    },
    auth: {
      tokenGetter: getAuthToken,
      csrfTokenGetter: getCsrfToken,
      onTokenExpired: async () => {
        // Token expired - could trigger refresh here
        console.warn('[API] Token expired');
      },
    },
    ...config,
  };

  return new EnhancedAPIClient(defaultConfig);
}

/**
 * Default API client instance (singleton)
 */
let defaultClient: EnhancedAPIClient | null = null;

/**
 * Get or create default API client
 */
export function getAPIClient(): EnhancedAPIClient {
  if (!defaultClient) {
    defaultClient = createAPIClient();
  }
  return defaultClient;
}

/**
 * Set default API client
 */
export function setAPIClient(client: EnhancedAPIClient): void {
  defaultClient = client;
}

/**
 * Reset default API client
 */
export function resetAPIClient(): void {
  defaultClient = null;
}


