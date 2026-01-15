/**
 * Shared API Framework - Client Export
 * 
 * Re-exports only the client-side API framework
 * Use this for frontend/browser code
 */

// Export single APIClient with optional features
export {
  APIClient,
  createAPIClient,
  getAPIClient,
  setAPIClient,
  resetAPIClient,
} from './src/client';

export type {
  APIRequest,
  APIResponse,
  APIError,
  APIClientConfig,
  Middleware,
  Plugin,
  RequestPriority,
  CacheConfig,
  RetryConfig,
  OptimisticConfig,
  OfflineConfig,
} from './src/types';

// Re-export encryption utilities for client-side use
export {
  encryptBinaryWithJWT,
  decryptBinaryWithJWT,
  encryptWithJWT,
  decryptWithJWT,
} from './encryption/index';

