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
export * from './src/index';

// Re-export enhanced framework (excluding APIResponse, E2EEncryptionConfig, EncryptedData to avoid conflicts)
export type {
  BuiltResponse, EnhancedAPIClientConfig, ErrorHandlingConfig, FilteringParams, MetricDefinition, RequestContext, ResponseBuilderOptions, ResponseFilterConfig, RFC7807Error, RootResponseConfig, TypeDefinition, WorkerAdapterConfig
} from './src/enhanced/types';

// Re-export enhanced APIResponse as EnhancedAPIResponse to avoid conflict
export type { APIResponse as EnhancedAPIResponse } from './src/enhanced/types';

// Re-export enhanced framework exports (excluding APIResponse)
// Note: EnhancedAPIClientV2 has been merged into APIClient - use createAPIClient with feature flags instead
// CRITICAL: Do NOT re-export encryptWithJWT/decryptWithJWT from enhanced to avoid circular dependency
// These are already exported from encryption/index.js above
export {
  applyFiltering, buildResponse, clearCachedMetric, COMMON_TAGS, composeServerMiddlewares, computeMetric,
  computeMetrics, createCORSHeaders, createCORSMiddleware, createE2EEncryptionMiddleware, createEnhancedHandler, createErrorLegendMiddleware, createGetHandler, createKVCache, createPostHandler, createResponseBuilderMiddleware, createResponseFilterMiddleware, createRFC7807Error, createRFC7807Response, createServerMiddleware, createWorkerAdapter,
  createWorkerHandler, detectPlatform, enhanceErrorWithLegend, formatErrorAsRFC7807, generateMetricCacheKey, getStorageAdapter, getTagFields, getType, getTypeRegistry, handleCORSPreflight, initializeCommonTags, isBrowser, isCloudflareWorker, isNode, KVCache, parseFilteringParams, registerTag, registerType, TypeRegistry, validateResponse, withMiddleware, WorkerAdapter
} from './src/enhanced/index';

export type {
  CORSOptions, HandlerContext, HandlerOptions, KVCacheOptions, ServerMiddleware
} from './src/enhanced/index';

// Re-export client factory for convenience
export {
  createAPIClient, getAPIClient, resetAPIClient, setAPIClient
} from './src/factory';

// Re-export encryption utilities
export {
  applyEncryptionMiddleware,
  createEncryptionWrapper,
  createServicePolicies,
  decryptBinaryWithJWT,
  decryptBinaryWithSharedKey,
  decryptMultiStage,
  decryptTwoStage,
  decryptWithJWT,
  encryptBinaryWithJWT,
  encryptBinaryWithSharedKey,
  encryptMultiStage,
  encryptTwoStage,
  encryptWithJWT,
  generateRequestKey,
  isDoubleEncrypted,
  isMultiEncrypted,
  withEncryption,
  wrapWithEncryption
} from './encryption/index';

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
} from './encryption/index';

// Re-export fingerprinting utilities
export {
  createFingerprint,
  createFingerprintHash,
  hashFingerprint,
  validateFingerprint,
  validateFingerprintLenient,
} from './fingerprint';

export type {
  FingerprintData,
  FingerprintHash,
} from './fingerprint';

// Re-export route protection utilities
export {
  protectAdminRoute,
  withAdminProtection,
  verifySuperAdminKey,
  extractAuth,
  authenticateJWT,
  createUnauthorizedResponse,
  createForbiddenResponse,
} from './route-protection';

export type {
  AdminLevel,
  RouteProtectionEnv,
  RouteProtectionResult,
  AuthResult as RouteProtectionAuthResult,
} from './route-protection';

// Re-export customer lookup utilities (customer-lookup is part of api-framework)
// All application code should import these from @strixun/api-framework
export {
  fetchCustomerByCustomerId,
  fetchDisplayNameByCustomerId,
  fetchDisplayNamesByCustomerIds,
  fetchCustomersByCustomerIds,
  getCustomer,
  getCustomerByEmail,
  getCurrentCustomer,
  getCustomerService,
  getCustomerByEmailService,
  createCustomer,
  updateCustomer,
  getCustomerRoles,
  isSuperAdminByCustomerId,
} from './customer-lookup';

export type {
  CustomerData,
  CustomerLookupEnv,
} from './customer-lookup';

// Re-export upload limits utilities
export {
  BASE_UPLOAD_LIMIT,
  DEFAULT_UPLOAD_LIMITS,
  getUploadLimits,
  formatFileSize,
  validateFileSize,
  createFileSizeValidator,
  calculateRichTextPayloadSize,
  validateRichTextPayload,
} from './upload-limits';

export type {
  UploadLimitsConfig,
  RichTextPayloadValidation,
  EmbeddedMediaInfo,
} from './upload-limits';

// Re-export JWT utilities (canonical implementation)
export {
  createJWT,
  verifyJWT,
  getJWTSecret,
} from './jwt';

export type {
  JWTPayload,
} from './jwt';

// Re-export service URL resolution utilities
export {
  getServiceUrl,
  getAuthApiUrl,
  getCustomerApiUrl,
  getModsApiUrl,
  isLocalDev,
} from './src/utils/service-url';

export type {
  ServiceUrlEnv,
  ServiceUrlConfig,
} from './src/utils/service-url';

