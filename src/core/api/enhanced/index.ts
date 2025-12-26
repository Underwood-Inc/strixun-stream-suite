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

// Client
export {
  EnhancedAPIClientV2,
  createEnhancedAPIClient,
  getEnhancedAPIClient,
  setEnhancedAPIClient,
  resetEnhancedAPIClient,
} from './client';

// Encryption
export {
  encryptWithJWT,
  decryptWithJWT,
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

// Workers - CORS utilities
export {
  createCORSMiddleware,
  createCORSHeaders,
  handleCORSPreflight,
} from './workers/cors';

export type {
  CORSOptions,
} from './workers/cors';

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

