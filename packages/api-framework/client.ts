/**
 * Shared API Framework - Client Export
 * 
 * Re-exports only the client-side API framework
 * Use this for frontend/browser code
 */

export {
  getAPIClient,
  createAPIClient,
  setAPIClient,
  resetAPIClient,
  APIClient,
  EnhancedAPIClient,
} from './src/index.js';

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
} from './src/types.js';

