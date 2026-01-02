/**
 * API Framework - Main Export
 * 
 * Facebook/Meta-level API framework for Strixun Stream Suite
 */

// Export APIClient - single client with optional features
export {
  APIClient,
  createAPIClient,
  getAPIClient,
  setAPIClient,
  resetAPIClient,
} from './client.js';

// Types
export type {
  HTTPMethod,
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
  WebSocketRequest,
  WebSocketResponse,
} from './types';

// Request management
export {
  RequestDeduplicator,
  RequestQueue,
  CancellationManager,
  comparePriority,
  getDefaultPriority,
  isHigherPriority,
} from './request';

export type { QueueConfig } from './request';

// Resilience
export {
  RetryManager,
  CircuitBreaker,
  OfflineQueue,
} from './resilience';

export type {
  RetryConfig as RetryConfigType,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
  OfflineConfig as OfflineConfigType,
} from './resilience';

// Cache
export {
  MemoryCache,
  IndexedDBCache,
  CacheManager,
} from './cache';

// Batching
export {
  RequestBatcher,
  RequestDebouncer,
} from './batch';

export type {
  BatcherConfig,
  DebouncerConfig,
} from './batch';

// Optimistic updates
export {
  OptimisticUpdateManager,
} from './optimistic';

// WebSocket
export {
  WebSocketClient,
} from './websocket';

export type {
  WebSocketConfig,
} from './websocket';

// Plugins
export {
  PluginManager,
  createLoggingPlugin,
  createMetricsPlugin,
  createAnalyticsPlugin,
} from './plugins';

export type {
  LoggingConfig,
  MetricsConfig,
  Metric,
  AnalyticsConfig,
} from './plugins';

// Utils
export {
  RequestBuilder,
  createRequest,
} from './utils/request-builder';

export {
  handleResponse,
  handleErrorResponse,
  createError,
  isRetryableError,
  isSuccessResponse,
  extractErrorMessage,
} from './utils/response-handler';

export {
  getServiceUrl,
  getAuthApiUrl,
  getCustomerApiUrl,
  getModsApiUrl,
  isLocalDev,
} from './utils/service-url';

export type {
  ServiceUrlEnv,
  ServiceUrlConfig,
} from './utils/service-url';

// Middleware
export {
  MiddlewarePipeline,
} from './middleware';

export {
  createAuthMiddleware,
} from './middleware/auth';

export {
  createErrorMiddleware,
} from './middleware/error';

export {
  createTransformMiddleware,
  defaultRequestTransformer,
  defaultResponseTransformer,
} from './middleware/transform';

