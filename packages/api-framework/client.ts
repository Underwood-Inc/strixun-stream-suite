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
} from '../../../src/core/api/index.js';

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
} from '../../../src/core/api/types.js';

