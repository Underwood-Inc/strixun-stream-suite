/**
 * @strixun/error-utils - Error Factory
 * 
 * Factory functions for creating typed application errors with full context.
 */

import type {
    ApplicationError,
    HTTPStatusCode,
    ErrorCategory,
    CreateErrorOptions,
    CreateValidationErrorOptions,
    ValidationError,
} from './types';

// ============================================================================
// Application Error Class
// ============================================================================

/**
 * Typed application error class
 * 
 * @template TData - Type of additional error data
 * @template TExtensions - Type of RFC 7807 extensions
 */
export class AppError<
    TData = unknown,
    TExtensions extends Record<string, unknown> = Record<string, unknown>
> extends Error implements ApplicationError<TData, TExtensions> {
    public readonly status: HTTPStatusCode;
    public readonly category: ErrorCategory;
    public readonly code: string;
    public readonly originalCause?: Error | unknown;
    public readonly data?: TData;
    public readonly isOperational: boolean;
    public readonly retryable: boolean;
    public readonly retryAfterMs?: number;
    public readonly timestamp: string;
    public readonly extensions?: TExtensions;

    constructor(options: CreateErrorOptions<TData, TExtensions>) {
        super(options.message);
        
        this.name = 'AppError';
        this.status = options.status || 500;
        this.category = options.category || inferCategory(this.status);
        this.code = options.code || `${this.category}_error`;
        this.originalCause = options.cause;
        this.data = options.data;
        this.isOperational = options.isOperational ?? true;
        this.retryable = options.retryable ?? isRetryableByDefault(this.status);
        this.retryAfterMs = options.retryAfterMs;
        this.timestamp = new Date().toISOString();
        this.extensions = options.extensions;

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * Convert to plain object
     */
    toJSON(): ApplicationError<TData, TExtensions> {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            category: this.category,
            code: this.code,
            cause: this.originalCause instanceof Error ? this.originalCause.message : this.originalCause,
            data: this.data,
            stack: this.stack,
            isOperational: this.isOperational,
            retryable: this.retryable,
            retryAfterMs: this.retryAfterMs,
            timestamp: this.timestamp,
            extensions: this.extensions,
        };
    }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create an application error
 * 
 * @example
 * ```typescript
 * const error = createError({
 *   message: 'User not found',
 *   status: 404,
 *   category: 'not_found',
 *   code: 'user_not_found',
 *   data: { userId: '123' }
 * });
 * ```
 */
export function createError<
    TData = unknown,
    TExtensions extends Record<string, unknown> = Record<string, unknown>
>(options: CreateErrorOptions<TData, TExtensions>): AppError<TData, TExtensions> {
    return new AppError(options);
}

/**
 * Create a validation error (422)
 */
export function createValidationError(
    options: CreateValidationErrorOptions
): AppError<{ errors: ValidationError[] }> {
    return new AppError({
        message: options.message,
        status: 422,
        category: 'validation',
        code: options.code || 'validation_error',
        cause: options.cause,
        data: { errors: options.errors },
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create a not found error (404)
 */
export function createNotFoundError(
    resource: string,
    identifier?: string | number
): AppError<{ resource: string; identifier?: string | number }> {
    const message = identifier
        ? `${resource} with ID '${identifier}' was not found`
        : `${resource} was not found`;

    return new AppError({
        message,
        status: 404,
        category: 'not_found',
        code: `${resource.toLowerCase().replace(/\s+/g, '_')}_not_found`,
        data: { resource, identifier },
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create an unauthorized error (401)
 */
export function createUnauthorizedError(
    message = 'Authentication required'
): AppError {
    return new AppError({
        message,
        status: 401,
        category: 'authentication',
        code: 'unauthorized',
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create a forbidden error (403)
 */
export function createForbiddenError(
    message = 'Access denied'
): AppError {
    return new AppError({
        message,
        status: 403,
        category: 'authorization',
        code: 'forbidden',
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create a conflict error (409)
 */
export function createConflictError(
    message: string,
    resource?: string
): AppError<{ resource?: string }> {
    return new AppError({
        message,
        status: 409,
        category: 'conflict',
        code: resource ? `${resource.toLowerCase()}_conflict` : 'conflict',
        data: { resource },
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create a rate limit error (429)
 */
export function createRateLimitError(
    message = 'Too many requests',
    retryAfterMs?: number
): AppError<{ retryAfterMs?: number }> {
    return new AppError({
        message,
        status: 429,
        category: 'rate_limit',
        code: 'rate_limit_exceeded',
        data: { retryAfterMs },
        isOperational: true,
        retryable: true,
        retryAfterMs,
    });
}

/**
 * Create a bad request error (400)
 */
export function createBadRequestError(
    message: string,
    code = 'bad_request'
): AppError {
    return new AppError({
        message,
        status: 400,
        category: 'validation',
        code,
        isOperational: true,
        retryable: false,
    });
}

/**
 * Create an internal server error (500)
 */
export function createInternalError(
    message = 'An unexpected error occurred',
    cause?: Error | unknown
): AppError {
    return new AppError({
        message,
        status: 500,
        category: 'server',
        code: 'internal_error',
        cause,
        isOperational: false,
        retryable: false,
    });
}

/**
 * Create a service unavailable error (503)
 */
export function createServiceUnavailableError(
    message = 'Service temporarily unavailable',
    retryAfterMs?: number
): AppError<{ retryAfterMs?: number }> {
    return new AppError({
        message,
        status: 503,
        category: 'server',
        code: 'service_unavailable',
        data: { retryAfterMs },
        isOperational: true,
        retryable: true,
        retryAfterMs,
    });
}

/**
 * Create a timeout error (504)
 */
export function createTimeoutError(
    message = 'Request timed out'
): AppError {
    return new AppError({
        message,
        status: 504,
        category: 'timeout',
        code: 'timeout',
        isOperational: true,
        retryable: true,
    });
}

/**
 * Create an external service error (502)
 */
export function createExternalServiceError(
    serviceName: string,
    originalError?: Error | unknown
): AppError<{ serviceName: string }> {
    return new AppError({
        message: `External service '${serviceName}' failed`,
        status: 502,
        category: 'external_service',
        code: 'external_service_error',
        cause: originalError,
        data: { serviceName },
        isOperational: true,
        retryable: true,
    });
}

/**
 * Create a configuration error (500)
 */
export function createConfigurationError(
    message: string,
    missingConfig?: string
): AppError<{ missingConfig?: string }> {
    return new AppError({
        message,
        status: 500,
        category: 'configuration',
        code: 'configuration_error',
        data: { missingConfig },
        isOperational: false,
        retryable: false,
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Infer error category from HTTP status code
 */
function inferCategory(status: HTTPStatusCode): ErrorCategory {
    switch (status) {
        case 401:
            return 'authentication';
        case 403:
            return 'authorization';
        case 404:
        case 410:
            return 'not_found';
        case 409:
            return 'conflict';
        case 422:
            return 'validation';
        case 429:
            return 'rate_limit';
        case 408:
        case 504:
            return 'timeout';
        case 502:
            return 'external_service';
        default:
            if (status >= 400 && status < 500) {
                return 'validation';
            }
            if (status >= 500) {
                return 'server';
            }
            return 'unknown';
    }
}

/**
 * Determine if an error should be retryable by default based on status
 */
function isRetryableByDefault(status: HTTPStatusCode): boolean {
    return status === 429 || status === 503 || status === 504 || status === 502;
}

/**
 * Wrap an unknown error as an AppError
 */
export function wrapError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError({
            message: error.message,
            status: 500,
            category: 'unknown',
            code: 'wrapped_error',
            cause: error,
            isOperational: false,
            retryable: false,
        });
    }

    return new AppError({
        message: String(error),
        status: 500,
        category: 'unknown',
        code: 'unknown_error',
        cause: error,
        isOperational: false,
        retryable: false,
    });
}
