/**
 * Enhanced API Framework - Main Export
 * 
 * Public API for the enhanced API framework
 */

// Types
export type {
  RootResponseConfig,
  APIResponse,
  EnhancedAPIClientConfig,
  E2EEncryptionConfig,
  EncryptedData,
  ResponseFilterConfig,
  TypeDefinition,
  MetricDefinition,
  ErrorHandlingConfig,
  RFC7807Error,
  RequestContext,
  WorkerAdapterConfig,
  FilteringParams,
  ResponseBuilderOptions,
  BuiltResponse,
} from './types';

// Enhanced features are now part of APIClient - no separate client class needed
// All enhanced functionality is available via APIClient with feature flags

// Encryption - only export the middleware, not the re-exports to avoid circular dependency
// Users should import encryptWithJWT/decryptWithJWT directly from @strixun/api-framework
export {
  createE2EEncryptionMiddleware,
} from './encryption';

// Filtering
export {
  parseFilteringParams,
  applyFiltering,
  createResponseFilterMiddleware,
  registerTag,
  getTagFields,
  initializeCommonTags,
  COMMON_TAGS,
} from './filtering';

// Response Building
export {
  buildResponse,
  validateResponse,
  createResponseBuilderMiddleware,
  computeMetric,
  computeMetrics,
  clearCachedMetric,
  generateMetricCacheKey,
} from './building';

// Error Handling
export {
  createRFC7807Error,
  formatErrorAsRFC7807,
  createRFC7807Response,
  enhanceErrorWithLegend,
  createErrorLegendMiddleware,
} from './errors';

// Workers - CORS utilities (production)
export {
  createCORSMiddleware,
  createCORSHeaders,
  handleCORSPreflight,
  getCorsHeaders,
} from './workers/cors';

// Workers - CORS with localhost (development only)
export {
  getCorsHeaders as getCorsHeadersWithLocalhost,
  createCORSHeaders as createCORSHeadersWithLocalhost,
  handleCORSPreflight as handleCORSPreflightWithLocalhost,
} from './workers/cors-with-localhost';

export type {
  CORSOptions,
} from './workers/cors';
export type {
  CORSWithLocalhostOptions,
} from './workers/cors-with-localhost';

// Workers - Handler utilities
export {
  detectPlatform,
  isCloudflareWorker,
  isBrowser,
  isNode,
  getStorageAdapter,
} from './workers/platform';

export {
  KVCache,
  createKVCache,
} from './workers/kv-cache';

export {
  WorkerAdapter,
  createWorkerAdapter,
  createWorkerHandler,
} from './workers/adapter';

export {
  createEnhancedHandler,
  createGetHandler,
  createPostHandler,
} from './workers/handler';

export type {
  KVCacheOptions,
} from './workers/kv-cache';

export type {
  HandlerOptions,
  HandlerContext,
} from './workers/handler';

// Registry
export {
  TypeRegistry,
  getTypeRegistry,
  registerType,
  getType,
} from './registry';

// Middleware Composition
export {
  composeServerMiddlewares,
  createServerMiddleware,
  withMiddleware,
} from './middleware';

export type {
  ServerMiddleware,
} from './middleware';

