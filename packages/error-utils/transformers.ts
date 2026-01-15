/**
 * @strixun/error-utils - Error Transformers
 * 
 * Composable transformers for converting between error formats.
 */

import type {
    ApplicationError,
    RFC7807Error,
    RFC7807ErrorWithExtensions,
    ErrorContext,
    ErrorTransformer,
    HTTPStatusCode,
    ValidationError,
} from './types';
import { AppError, wrapError } from './factory';
import { getTypeUri, getTitle } from './rfc7807';

// ============================================================================
// Error to RFC 7807 Transformers
// ============================================================================

/**
 * Options for transforming errors to RFC 7807 format
 */
export interface ToRFC7807Options {
    /** Custom type URI base */
    typeBaseUri?: string;
    /** Include debug information */
    includeDebug?: boolean;
    /** Include stack trace */
    includeStack?: boolean;
    /** Include error code in extensions */
    includeErrorCode?: boolean;
    /** Include backward-compatible 'error' field */
    includeBackwardCompat?: boolean;
}

/**
 * Transform an ApplicationError to RFC 7807 format
 */
export function appErrorToRFC7807<TData, TExtensions extends Record<string, unknown>>(
    error: ApplicationError<TData, TExtensions>,
    context?: ErrorContext,
    options: ToRFC7807Options = {}
): RFC7807ErrorWithExtensions {
    const {
        typeBaseUri,
        includeDebug = false,
        includeStack = false,
        includeErrorCode = true,
        includeBackwardCompat = false,
    } = options;

    const extensions: RFC7807ErrorWithExtensions['extensions'] = {
        timestamp: error.timestamp,
        retryable: error.retryable,
    };

    if (includeErrorCode) {
        extensions.errorCode = error.code;
    }

    if (error.retryAfterMs) {
        extensions.retryAfter = Math.ceil(error.retryAfterMs / 1000);
    }

    if (context?.requestId) {
        extensions.traceId = context.requestId;
    }

    // Handle validation errors
    if (error.data && typeof error.data === 'object' && 'errors' in error.data) {
        const data = error.data as { errors?: ValidationError[] };
        if (Array.isArray(data.errors)) {
            extensions.validationErrors = data.errors;
        }
    }

    // Debug information (only in development)
    if (includeDebug && context?.environment === 'development') {
        extensions.debug = {
            category: error.category,
            isOperational: error.isOperational,
            ...(error.data ? { data: error.data } : {}),
        };

        if (includeStack && error.stack) {
            extensions.debug.stack = error.stack;
        }

        if (error.cause) {
            extensions.debug.cause = error.cause instanceof Error 
                ? error.cause.message 
                : String(error.cause);
        }
    }

    const rfc7807: RFC7807ErrorWithExtensions = {
        type: getTypeUri(error.status, typeBaseUri),
        title: getTitle(error.status),
        status: error.status,
        detail: error.message,
        instance: context?.url,
        extensions,
    };

    // Add backward-compatible 'error' field for legacy clients
    if (includeBackwardCompat) {
        (rfc7807 as RFC7807ErrorWithExtensions & { error: string }).error = error.message;
    }

    return rfc7807;
}

/**
 * Transform any error to RFC 7807 format
 */
export function toRFC7807(
    error: unknown,
    context?: ErrorContext,
    options: ToRFC7807Options = {}
): RFC7807ErrorWithExtensions {
    const appError = wrapError(error);
    return appErrorToRFC7807(appError, context, options);
}

// ============================================================================
// RFC 7807 to ApplicationError Transformers
// ============================================================================

/**
 * Transform an RFC 7807 error to ApplicationError
 */
export function rfc7807ToAppError<TExtensions extends Record<string, unknown>>(
    rfc7807: RFC7807Error<TExtensions>
): AppError<TExtensions> {
    const extensions = rfc7807.extensions || {} as TExtensions;
    
    // Extract error code from extensions if available
    const errorCode = 'errorCode' in extensions 
        ? String(extensions.errorCode) 
        : undefined;

    // Extract retryable from extensions
    const retryable = 'retryable' in extensions 
        ? Boolean(extensions.retryable) 
        : undefined;

    // Extract retryAfter from extensions
    const retryAfter = 'retryAfter' in extensions 
        ? Number(extensions.retryAfter) * 1000 
        : undefined;

    return new AppError({
        message: rfc7807.detail,
        status: rfc7807.status,
        code: errorCode,
        retryable,
        retryAfterMs: retryAfter,
        extensions,
    });
}

// ============================================================================
// Composable Transformer Pipeline
// ============================================================================

/**
 * Create a transformer pipeline
 * 
 * @example
 * ```typescript
 * const transformer = createTransformerPipeline(
 *   normalizeError,
 *   addTimestamp,
 *   addTraceId,
 *   sanitizeForProduction
 * );
 * 
 * const result = transformer(error, context);
 * ```
 */
export function createTransformerPipeline<TInput, TOutput>(
    ...transformers: ErrorTransformer[]
): ErrorTransformer<TInput, TOutput extends ApplicationError ? TOutput : ApplicationError> {
    return (error: TInput, context?: ErrorContext) => {
        let result: unknown = error;
        
        for (const transformer of transformers) {
            result = transformer(result, context);
        }
        
        return result as TOutput extends ApplicationError ? TOutput : ApplicationError;
    };
}

// ============================================================================
// Common Transformers
// ============================================================================

/**
 * Normalize any error to ApplicationError
 */
export const normalizeError: ErrorTransformer<unknown, AppError> = (error) => {
    return wrapError(error);
};

/**
 * Add timestamp if missing
 */
export const addTimestamp: ErrorTransformer<ApplicationError, ApplicationError> = (error) => {
    if (!error.timestamp) {
        return { ...error, timestamp: new Date().toISOString() };
    }
    return error;
};

/**
 * Add trace ID from context
 */
export const addTraceId: ErrorTransformer<ApplicationError, ApplicationError> = (
    error,
    context
) => {
    if (context?.requestId && !error.extensions?.traceId) {
        // Explicitly include message since it's inherited from Error and not spread
        return {
            ...error,
            name: error.name,
            message: error.message,
            extensions: {
                ...error.extensions,
                traceId: context.requestId,
            },
        };
    }
    return error;
};

/**
 * Sanitize error for production (remove sensitive data)
 */
export const sanitizeForProduction: ErrorTransformer<ApplicationError, ApplicationError> = (
    error,
    context
) => {
    if (context?.environment === 'production') {
        // Remove potentially sensitive information
        const sanitized = { ...error };
        delete sanitized.stack;
        delete sanitized.cause;
        
        if (sanitized.extensions) {
            const ext = { ...sanitized.extensions };
            delete ext.debug;
            sanitized.extensions = ext;
        }

        // Generalize internal errors
        if (!error.isOperational && error.status >= 500) {
            sanitized.message = 'An unexpected error occurred. Please try again later.';
        }

        return sanitized;
    }
    return error;
};

/**
 * Mask sensitive fields in validation errors
 */
export const maskSensitiveFields: ErrorTransformer<ApplicationError, ApplicationError> = (error) => {
    if (error.data && typeof error.data === 'object' && 'errors' in error.data) {
        const data = error.data as { errors?: ValidationError[] };
        if (Array.isArray(data.errors)) {
            const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'api_key'];
            const maskedErrors = data.errors.map(err => {
                const fieldLower = err.field.toLowerCase();
                const isSensitive = sensitiveFields.some(f => fieldLower.includes(f));
                
                return isSensitive
                    ? { ...err, value: '***REDACTED***' }
                    : err;
            });

            return {
                ...error,
                data: { ...data, errors: maskedErrors },
            };
        }
    }
    return error;
};

// ============================================================================
// Status Code Transformers
// ============================================================================

/**
 * Override error status code
 */
export function withStatus(status: HTTPStatusCode): ErrorTransformer<ApplicationError, ApplicationError> {
    return (error) => ({ ...error, status });
}

/**
 * Make error retryable
 */
export function withRetry(retryAfterMs?: number): ErrorTransformer<ApplicationError, ApplicationError> {
    return (error) => ({
        ...error,
        retryable: true,
        retryAfterMs: retryAfterMs ?? error.retryAfterMs,
    });
}

/**
 * Add error code
 */
export function withCode(code: string): ErrorTransformer<ApplicationError, ApplicationError> {
    return (error) => ({ ...error, code });
}

/**
 * Add custom data
 */
export function withData<T>(data: T): ErrorTransformer<ApplicationError, ApplicationError<T>> {
    return (error) => ({ ...error, data }) as ApplicationError<T>;
}
