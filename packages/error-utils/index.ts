/**
 * @strixun/error-utils
 * 
 * Framework-agnostic error handling utilities with RFC 7807 Problem Details support,
 * strong typing, and composable error transformations.
 * 
 * @packageDocumentation
 * 
 * @example Basic Usage
 * ```typescript
 * import {
 *   createNotFoundError,
 *   buildWebResponse,
 * } from '@strixun/error-utils';
 * 
 * // Create a typed error
 * const error = createNotFoundError('User', '123');
 * 
 * // Build an RFC 7807 compliant response
 * return buildWebResponse(error, { url: request.url });
 * ```
 * 
 * @example Validation Errors
 * ```typescript
 * import {
 *   createValidationError,
 *   buildWebResponse,
 * } from '@strixun/error-utils';
 * 
 * const error = createValidationError({
 *   message: 'Validation failed',
 *   errors: [
 *     { field: 'email', message: 'Invalid email format' },
 *     { field: 'age', message: 'Must be a positive number' },
 *   ],
 * });
 * 
 * return buildWebResponse(error);
 * ```
 * 
 * @example Custom Transformers
 * ```typescript
 * import {
 *   createTransformerPipeline,
 *   normalizeError,
 *   addTraceId,
 *   sanitizeForProduction,
 *   toRFC7807,
 * } from '@strixun/error-utils';
 * 
 * const transformer = createTransformerPipeline(
 *   normalizeError,
 *   addTraceId,
 *   sanitizeForProduction,
 * );
 * 
 * const processed = transformer(error, context);
 * const rfc7807 = toRFC7807(processed, context);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
    // HTTP Types
    HTTPStatusCode,
    HTTPStatusCategory,
    
    // RFC 7807 Types
    RFC7807Error,
    RFC7807ErrorWithExtensions,
    
    // Validation Types
    ValidationError,
    ValidationResult,
    
    // Error Types
    ErrorCategory,
    ErrorCode,
    ApplicationError,
    ErrorContext,
    
    // Configuration Types
    ErrorHandlerConfig,
    ErrorTransformer,
    ErrorLogger,
    CreateErrorOptions,
    CreateValidationErrorOptions,
    
    // Response Types
    ErrorResponse,
    ResponseBuilderConfig,
} from './types';

// ============================================================================
// RFC 7807 Implementation
// ============================================================================

export {
    // Constants
    RFC_TYPE_URIS,
    STATUS_TITLES,
    
    // Error Creation
    createRFC7807,
    createRFC7807WithContext,
    createValidationRFC7807,
    createRateLimitRFC7807,
    
    // Utilities
    getTypeUri,
    getTitle,
    isClientError,
    isServerError,
    isRetryableStatus,
    mergeRFC7807Errors,
    
    // Types
    type RFC7807Options,
} from './rfc7807';

// ============================================================================
// Error Factory
// ============================================================================

export {
    // Error Class
    AppError,
    
    // Factory Functions
    createError,
    createValidationError,
    createNotFoundError,
    createUnauthorizedError,
    createForbiddenError,
    createConflictError,
    createRateLimitError,
    createBadRequestError,
    createInternalError,
    createServiceUnavailableError,
    createTimeoutError,
    createExternalServiceError,
    createConfigurationError,
    
    // Utilities
    wrapError,
} from './factory';

// ============================================================================
// Transformers
// ============================================================================

export {
    // Error to RFC 7807
    appErrorToRFC7807,
    toRFC7807,
    
    // RFC 7807 to Error
    rfc7807ToAppError,
    
    // Pipeline
    createTransformerPipeline,
    
    // Common Transformers
    normalizeError,
    addTimestamp,
    addTraceId,
    sanitizeForProduction,
    maskSensitiveFields,
    
    // Transformer Factories
    withStatus,
    withRetry,
    withCode,
    withData,
    
    // Types
    type ToRFC7807Options,
} from './transformers';

// ============================================================================
// Response Builders
// ============================================================================

export {
    // Constants
    PROBLEM_JSON_CONTENT_TYPE,
    JSON_CONTENT_TYPE,
    
    // Response Builders
    buildErrorResponse,
    buildWebResponse,
    buildSimpleErrorResponse,
    buildSimpleWebResponse,
    
    // CORS Support
    buildCorsHeaders,
    buildErrorResponseWithCors,
    buildWebResponseWithCors,
    
    // Utilities
    isErrorResponse,
    extractErrorMessage,
    
    // Types
    type CorsOptions,
} from './response';

// ============================================================================
// Type Guards
// ============================================================================

export {
    // Error Guards
    isAppError,
    isApplicationError,
    isRFC7807Error,
    isRFC7807ErrorWithExtensions,
    isValidationError,
    isNativeError,
    
    // Status Guards
    isHTTPStatusCode,
    isClientError as isClientErrorStatus,
    isServerError as isServerErrorStatus,
    isErrorStatus,
    isSuccessStatus,
    isRetryableStatus as isRetryableStatusCode,
    
    // Category Guards
    isErrorCategory,
    hasCategory,
    isAuthenticationError,
    isAuthorizationError,
    isValidationErrorCategory,
    isNotFoundError,
    isRateLimitError,
    isServerErrorCategory,
    
    // Operational Guards
    isOperationalError,
    isProgrammerError,
    isRetryable,
    
    // Response Guards
    hasValidationErrors,
    hasExtensions,
    
    // Assertions
    assertApplicationError,
    assertRFC7807Error,
    assertHTTPStatusCode,
} from './guards';
