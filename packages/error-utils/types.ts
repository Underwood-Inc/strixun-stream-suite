/**
 * @strixun/error-utils - Type Definitions
 * 
 * Framework-agnostic error types with strong typing and generics support.
 * Implements RFC 7807 Problem Details for HTTP APIs.
 * 
 * @see https://tools.ietf.org/html/rfc7807
 */

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Standard HTTP status codes commonly used in error responses
 */
export type HTTPStatusCode = 
    | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 
    | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 421 
    | 422 | 423 | 424 | 425 | 426 | 428 | 429 | 431 | 451
    | 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511;

/**
 * HTTP status code categories
 */
export type HTTPStatusCategory = 'client' | 'server';

// ============================================================================
// RFC 7807 Problem Details
// ============================================================================

/**
 * RFC 7807 Problem Details base interface
 * 
 * @see https://tools.ietf.org/html/rfc7807
 * 
 * @template TExtensions - Additional custom fields for the error response
 */
export interface RFC7807Error<TExtensions extends Record<string, unknown> = Record<string, unknown>> {
    /**
     * A URI reference that identifies the problem type.
     * When dereferenced, it should provide human-readable documentation.
     * 
     * @example "https://api.example.com/errors/insufficient-funds"
     */
    type: string;

    /**
     * A short, human-readable summary of the problem type.
     * Should NOT change from occurrence to occurrence of the problem.
     * 
     * @example "Insufficient Funds"
     */
    title: string;

    /**
     * The HTTP status code for this occurrence of the problem.
     * 
     * @example 403
     */
    status: HTTPStatusCode;

    /**
     * A human-readable explanation specific to this occurrence.
     * Should focus on helping the client correct the problem.
     * 
     * @example "Your account balance is $30, but the transfer requires $50."
     */
    detail: string;

    /**
     * A URI reference that identifies the specific occurrence.
     * Typically the request URL or a unique error identifier.
     * 
     * @example "https://api.example.com/accounts/12345/transfers/67890"
     */
    instance?: string;

    /**
     * Extension fields for additional context
     */
    extensions?: TExtensions;
}

/**
 * RFC 7807 Error with common extension fields
 */
export interface RFC7807ErrorWithExtensions extends RFC7807Error<{
    /** Error code for programmatic handling */
    errorCode?: string;
    /** Timestamp when the error occurred */
    timestamp?: string;
    /** Trace ID for debugging */
    traceId?: string;
    /** Retry-After value in seconds */
    retryAfter?: number;
    /** Whether the operation can be retried */
    retryable?: boolean;
    /** Validation errors for 422 responses */
    validationErrors?: ValidationError[];
    /** Additional debug information (development only) */
    debug?: Record<string, unknown>;
}> {}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Individual field validation error
 */
export interface ValidationError {
    /** Field path (e.g., "user.email" or "items[0].quantity") */
    field: string;
    /** Error message for this field */
    message: string;
    /** Error code for this validation failure */
    code?: string;
    /** The invalid value (sanitized if sensitive) */
    value?: unknown;
    /** Constraints that were violated */
    constraints?: Record<string, string>;
}

/**
 * Validation result with multiple errors
 */
export interface ValidationResult<T = unknown> {
    /** Whether validation passed */
    valid: boolean;
    /** Validated data if valid */
    data?: T;
    /** Validation errors if invalid */
    errors?: ValidationError[];
}

// ============================================================================
// Error Categories & Codes
// ============================================================================

/**
 * Standard error categories for classification
 */
export type ErrorCategory =
    | 'authentication'
    | 'authorization'
    | 'validation'
    | 'not_found'
    | 'conflict'
    | 'rate_limit'
    | 'server'
    | 'network'
    | 'timeout'
    | 'configuration'
    | 'external_service'
    | 'business_logic'
    | 'unknown';

/**
 * Standard error codes with semantic meaning
 */
export interface ErrorCode<TCategory extends ErrorCategory = ErrorCategory> {
    /** The category this error belongs to */
    category: TCategory;
    /** Unique code within the category */
    code: string;
    /** Full error code (category.code) */
    fullCode: string;
    /** Default HTTP status for this error */
    defaultStatus: HTTPStatusCode;
    /** Default title for this error */
    defaultTitle: string;
}

// ============================================================================
// Application Error
// ============================================================================

/**
 * Application error with full context
 * 
 * @template TData - Type of additional error data
 * @template TExtensions - Type of RFC 7807 extensions
 */
export interface ApplicationError<
    TData = unknown,
    TExtensions extends Record<string, unknown> = Record<string, unknown>
> {
    /** Error name/type */
    name: string;
    /** Error message */
    message: string;
    /** HTTP status code */
    status: HTTPStatusCode;
    /** Error category */
    category: ErrorCategory;
    /** Unique error code */
    code: string;
    /** Original error if wrapped */
    cause?: Error | unknown;
    /** Additional error data */
    data?: TData;
    /** Stack trace (if available) */
    stack?: string;
    /** Whether the error is operational (expected) vs programmer error */
    isOperational: boolean;
    /** Whether the operation can be retried */
    retryable: boolean;
    /** Suggested retry delay in milliseconds */
    retryAfterMs?: number;
    /** Timestamp when error occurred */
    timestamp: string;
    /** RFC 7807 extensions */
    extensions?: TExtensions;
}

// ============================================================================
// Error Context
// ============================================================================

/**
 * Request context for error formatting
 */
export interface ErrorContext {
    /** Request URL or path */
    url?: string;
    /** Request method */
    method?: string;
    /** Request ID or trace ID */
    requestId?: string;
    /** User/customer ID if authenticated */
    userId?: string;
    /** Environment (development, staging, production) */
    environment?: 'development' | 'staging' | 'production';
    /** Additional context data */
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Handler Configuration
// ============================================================================

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlerConfig {
    /** Include stack traces in responses */
    includeStack?: boolean;
    /** Include debug information */
    includeDebug?: boolean;
    /** Include original error cause */
    includeCause?: boolean;
    /** Custom error type URI base */
    errorTypeBaseUri?: string;
    /** Default error category */
    defaultCategory?: ErrorCategory;
    /** Default retryable status */
    defaultRetryable?: boolean;
    /** Custom error transformer */
    transformer?: ErrorTransformer;
    /** Error logging function */
    logger?: ErrorLogger;
}

/**
 * Error transformer function
 */
export type ErrorTransformer<
    TInput = unknown,
    TOutput extends ApplicationError = ApplicationError
> = (error: TInput, context?: ErrorContext) => TOutput;

/**
 * Error logger function
 */
export type ErrorLogger = (
    error: ApplicationError,
    context?: ErrorContext
) => void | Promise<void>;

// ============================================================================
// Error Factory Types
// ============================================================================

/**
 * Options for creating an error
 */
export interface CreateErrorOptions<
    TData = unknown,
    TExtensions extends Record<string, unknown> = Record<string, unknown>
> {
    /** Error message */
    message: string;
    /** HTTP status code */
    status?: HTTPStatusCode;
    /** Error category */
    category?: ErrorCategory;
    /** Error code */
    code?: string;
    /** Original error cause */
    cause?: Error | unknown;
    /** Additional data */
    data?: TData;
    /** Whether operational */
    isOperational?: boolean;
    /** Whether retryable */
    retryable?: boolean;
    /** Retry delay in ms */
    retryAfterMs?: number;
    /** RFC 7807 extensions */
    extensions?: TExtensions;
}

/**
 * Options for creating a validation error
 */
export interface CreateValidationErrorOptions extends Omit<CreateErrorOptions, 'status' | 'category'> {
    /** Validation errors */
    errors: ValidationError[];
}

// ============================================================================
// Response Builder Types
// ============================================================================

/**
 * Framework-agnostic response representation
 */
export interface ErrorResponse<TBody = RFC7807Error> {
    /** HTTP status code */
    status: HTTPStatusCode;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body */
    body: TBody;
}

/**
 * Response builder configuration
 */
export interface ResponseBuilderConfig {
    /** Include CORS headers */
    includeCors?: boolean;
    /** Allowed origins for CORS */
    allowedOrigins?: string[];
    /** Additional headers to include */
    additionalHeaders?: Record<string, string>;
    /** Whether to include backward-compatible 'error' field */
    includeBackwardCompatError?: boolean;
}
