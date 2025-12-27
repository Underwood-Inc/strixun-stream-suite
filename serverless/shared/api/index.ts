/**
 * Shared API Framework - Main Export
 * 
 * Re-exports the full API framework from src/core/api for use in all workers and apps
 * 
 * This package makes the API framework available to:
 * - All Cloudflare Workers (mods-api, game-api, otp-auth-service, etc.)
 * - All frontend apps (mods-hub, control-panel, etc.)
 * 
 * Usage in Workers:
 * ```typescript
 * import { createEnhancedHandler, createWorkerHandler } from '@strixun/api-framework/enhanced';
 * ```
 * 
 * Usage in Frontend:
 * ```typescript
 * import { getAPIClient, createAPIClient } from '@strixun/api-framework/client';
 * ```
 */

// Re-export everything from the base API framework
export * from '../../../src/core/api/index.js';

// Re-export enhanced framework (excluding APIResponse, E2EEncryptionConfig, EncryptedData to avoid conflicts)
export type {
  BuiltResponse, EnhancedAPIClientConfig, ErrorHandlingConfig, FilteringParams, MetricDefinition, RequestContext, ResponseBuilderOptions, ResponseFilterConfig, RFC7807Error, RootResponseConfig, TypeDefinition, WorkerAdapterConfig
} from '../../../src/core/api/enhanced/types.js';

// Re-export enhanced APIResponse as EnhancedAPIResponse to avoid conflict
export type { APIResponse as EnhancedAPIResponse } from '../../../src/core/api/enhanced/types.js';

// Re-export enhanced framework exports (excluding APIResponse)
export {
  applyFiltering, buildResponse, clearCachedMetric, COMMON_TAGS, composeServerMiddlewares, computeMetric,
  computeMetrics, createCORSHeaders, createCORSMiddleware, createE2EEncryptionMiddleware, createEnhancedAPIClient, createEnhancedHandler, createErrorLegendMiddleware, createGetHandler, createKVCache, createPostHandler, createResponseBuilderMiddleware, createResponseFilterMiddleware, createRFC7807Error, createRFC7807Response, createServerMiddleware, createWorkerAdapter,
  createWorkerHandler, decryptWithJWT as decryptWithJWTEnhanced, detectPlatform, encryptWithJWT as encryptWithJWTEnhanced, EnhancedAPIClientV2, enhanceErrorWithLegend, formatErrorAsRFC7807, generateMetricCacheKey, getEnhancedAPIClient, getStorageAdapter, getTagFields, getType, getTypeRegistry, handleCORSPreflight, initializeCommonTags, isBrowser, isCloudflareWorker, isNode, KVCache, parseFilteringParams, registerTag, registerType, resetEnhancedAPIClient, setEnhancedAPIClient, TypeRegistry, validateResponse, withMiddleware, WorkerAdapter
} from '../../../src/core/api/enhanced/index.js';

export type {
  CORSOptions, HandlerContext, HandlerOptions, KVCacheOptions, ServerMiddleware
} from '../../../src/core/api/enhanced/index.js';

// Re-export client factory for convenience
export {
  createAPIClient, getAPIClient, resetAPIClient, setAPIClient
} from '../../../src/core/api/factory.js';

// Re-export encryption utilities
export {
  applyEncryptionMiddleware,
  createEncryptionWrapper,
  createServicePolicies,
  decryptMultiStage,
  decryptTwoStage,
  decryptWithJWT,
  decryptWithServiceKey,
  encryptMultiStage,
  encryptTwoStage,
  encryptWithJWT,
  encryptWithServiceKey,
  generateRequestKey,
  isDoubleEncrypted,
  isMultiEncrypted,
  withEncryption,
  wrapWithEncryption
} from '../encryption/index.js';

// Re-export encryption types
export type {
  AuthResult,
  E2EEncryptionConfig,
  EncryptedData,
  EncryptionContext,
  EncryptionMiddlewareOptions,
  EncryptionParty,
  EncryptionResult,
  EncryptionStrategy,
  EncryptionWrapperOptions,
  MultiStageEncryptedData,
  RouteEncryptionPolicy,
  RouteResult,
  TwoStageEncryptedData
} from '../encryption/index.js';

// Re-export fingerprinting utilities
export {
  createFingerprint,
  createFingerprintHash,
  hashFingerprint,
  validateFingerprint,
  validateFingerprintLenient,
} from './fingerprint.js';

export type {
  FingerprintData,
  FingerprintHash,
} from './fingerprint.js';

