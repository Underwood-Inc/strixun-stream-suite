/**
 * @strixun/error-utils - RFC 7807 Problem Details Implementation
 * 
 * Creates RFC 7807 compliant error responses for HTTP APIs.
 * 
 * @see https://tools.ietf.org/html/rfc7807
 */

import type {
    RFC7807Error,
    RFC7807ErrorWithExtensions,
    HTTPStatusCode,
    ErrorContext,
    ValidationError,
} from './types';

// ============================================================================
// RFC Type URIs
// ============================================================================

/**
 * Standard RFC type URIs for common HTTP status codes
 */
export const RFC_TYPE_URIS: Record<number, string> = {
    // 4xx Client Errors
    400: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',   // Bad Request
    401: 'https://tools.ietf.org/html/rfc7235#section-3.1',     // Unauthorized
    402: 'https://tools.ietf.org/html/rfc7231#section-6.5.2',   // Payment Required
    403: 'https://tools.ietf.org/html/rfc7231#section-6.5.3',   // Forbidden
    404: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',   // Not Found
    405: 'https://tools.ietf.org/html/rfc7231#section-6.5.5',   // Method Not Allowed
    406: 'https://tools.ietf.org/html/rfc7231#section-6.5.6',   // Not Acceptable
    408: 'https://tools.ietf.org/html/rfc7231#section-6.5.7',   // Request Timeout
    409: 'https://tools.ietf.org/html/rfc7231#section-6.5.8',   // Conflict
    410: 'https://tools.ietf.org/html/rfc7231#section-6.5.9',   // Gone
    411: 'https://tools.ietf.org/html/rfc7231#section-6.5.10',  // Length Required
    412: 'https://tools.ietf.org/html/rfc7232#section-4.2',     // Precondition Failed
    413: 'https://tools.ietf.org/html/rfc7231#section-6.5.11',  // Payload Too Large
    414: 'https://tools.ietf.org/html/rfc7231#section-6.5.12',  // URI Too Long
    415: 'https://tools.ietf.org/html/rfc7231#section-6.5.13',  // Unsupported Media Type
    422: 'https://tools.ietf.org/html/rfc4918#section-11.2',    // Unprocessable Entity
    429: 'https://tools.ietf.org/html/rfc6585#section-4',       // Too Many Requests
    
    // 5xx Server Errors
    500: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',   // Internal Server Error
    501: 'https://tools.ietf.org/html/rfc7231#section-6.6.2',   // Not Implemented
    502: 'https://tools.ietf.org/html/rfc7231#section-6.6.3',   // Bad Gateway
    503: 'https://tools.ietf.org/html/rfc7231#section-6.6.4',   // Service Unavailable
    504: 'https://tools.ietf.org/html/rfc7231#section-6.6.5',   // Gateway Timeout
} as const;

/**
 * Standard titles for HTTP status codes
 */
export const STATUS_TITLES: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
} as const;

// ============================================================================
// RFC 7807 Error Creation
// ============================================================================

/**
 * Options for creating an RFC 7807 error
 */
export interface RFC7807Options<TExtensions extends Record<string, unknown> = Record<string, unknown>> {
    /** Custom type URI (defaults to RFC standard) */
    type?: string;
    /** Custom title (defaults to standard HTTP status title) */
    title?: string;
    /** Instance URI (defaults to request URL) */
    instance?: string;
    /** Extension fields */
    extensions?: TExtensions;
}

/**
 * Create an RFC 7807 compliant error object
 * 
 * @param status - HTTP status code
 * @param detail - Human-readable error description
 * @param options - Additional options
 * @returns RFC 7807 compliant error object
 * 
 * @example
 * ```typescript
 * const error = createRFC7807({
 *   status: 404,
 *   detail: 'User with ID 123 was not found',
 *   options: { instance: '/api/users/123' }
 * });
 * ```
 */
export function createRFC7807<TExtensions extends Record<string, unknown> = Record<string, unknown>>(
    status: HTTPStatusCode,
    detail: string,
    options: RFC7807Options<TExtensions> = {}
): RFC7807Error<TExtensions> {
    const {
        type = getTypeUri(status),
        title = getTitle(status),
        instance,
        extensions,
    } = options;

    const error: RFC7807Error<TExtensions> = {
        type,
        title,
        status,
        detail,
    };

    if (instance) {
        error.instance = instance;
    }

    if (extensions && Object.keys(extensions).length > 0) {
        error.extensions = extensions;
    }

    return error;
}

/**
 * Create an RFC 7807 error from an error context
 * 
 * @param status - HTTP status code
 * @param detail - Human-readable error description
 * @param context - Request context
 * @param options - Additional options
 */
export function createRFC7807WithContext<TExtensions extends Record<string, unknown> = Record<string, unknown>>(
    status: HTTPStatusCode,
    detail: string,
    context: ErrorContext,
    options: Omit<RFC7807Options<TExtensions>, 'instance'> = {}
): RFC7807ErrorWithExtensions {
    const baseExtensions: RFC7807ErrorWithExtensions['extensions'] = {
        timestamp: new Date().toISOString(),
    };

    if (context.requestId) {
        baseExtensions.traceId = context.requestId;
    }

    // Merge with provided extensions
    const extensions = {
        ...baseExtensions,
        ...(options.extensions as Record<string, unknown> || {}),
    };

    return createRFC7807(status, detail, {
        ...options,
        instance: context.url,
        extensions,
    }) as RFC7807ErrorWithExtensions;
}

/**
 * Create a validation error (422 Unprocessable Entity)
 * 
 * @param detail - Human-readable description
 * @param errors - Validation error details
 * @param context - Optional request context
 */
export function createValidationRFC7807(
    detail: string,
    errors: ValidationError[],
    context?: ErrorContext
): RFC7807ErrorWithExtensions {
    const extensions: RFC7807ErrorWithExtensions['extensions'] = {
        validationErrors: errors,
        timestamp: new Date().toISOString(),
    };

    if (context?.requestId) {
        extensions.traceId = context.requestId;
    }

    return createRFC7807(422, detail, {
        instance: context?.url,
        extensions,
    }) as RFC7807ErrorWithExtensions;
}

/**
 * Create a rate limit error (429 Too Many Requests)
 * 
 * @param detail - Human-readable description
 * @param retryAfter - Seconds until rate limit resets
 * @param context - Optional request context
 */
export function createRateLimitRFC7807(
    detail: string,
    retryAfter: number,
    context?: ErrorContext
): RFC7807ErrorWithExtensions {
    const extensions: RFC7807ErrorWithExtensions['extensions'] = {
        retryAfter,
        retryable: true,
        timestamp: new Date().toISOString(),
    };

    if (context?.requestId) {
        extensions.traceId = context.requestId;
    }

    return createRFC7807(429, detail, {
        instance: context?.url,
        extensions,
    }) as RFC7807ErrorWithExtensions;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the RFC type URI for a status code
 */
export function getTypeUri(status: number, customBaseUri?: string): string {
    if (customBaseUri) {
        return `${customBaseUri}/errors/${status}`;
    }
    return RFC_TYPE_URIS[status] || RFC_TYPE_URIS[500];
}

/**
 * Get the standard title for a status code
 */
export function getTitle(status: number): string {
    return STATUS_TITLES[status] || 'Error';
}

/**
 * Check if a status code is a client error (4xx)
 */
export function isClientError(status: number): boolean {
    return status >= 400 && status < 500;
}

/**
 * Check if a status code is a server error (5xx)
 */
export function isServerError(status: number): boolean {
    return status >= 500 && status < 600;
}

/**
 * Determine if an error should be retryable based on status
 */
export function isRetryableStatus(status: number): boolean {
    // 429 (rate limit), 503 (service unavailable), 504 (gateway timeout)
    return status === 429 || status === 503 || status === 504;
}

/**
 * Merge RFC 7807 errors (useful for aggregating validation errors)
 */
export function mergeRFC7807Errors(
    errors: RFC7807ErrorWithExtensions[]
): RFC7807ErrorWithExtensions {
    if (errors.length === 0) {
        return createRFC7807(400, 'Multiple errors occurred') as RFC7807ErrorWithExtensions;
    }

    if (errors.length === 1) {
        return errors[0];
    }

    // Collect all validation errors
    const allValidationErrors: ValidationError[] = [];
    for (const error of errors) {
        if (error.extensions?.validationErrors) {
            allValidationErrors.push(...error.extensions.validationErrors);
        }
    }

    // Use the highest status code
    const maxStatus = Math.max(...errors.map(e => e.status)) as HTTPStatusCode;

    return createRFC7807(maxStatus, 'Multiple errors occurred', {
        extensions: {
            validationErrors: allValidationErrors.length > 0 ? allValidationErrors : undefined,
            errorCount: errors.length,
            timestamp: new Date().toISOString(),
        },
    }) as RFC7807ErrorWithExtensions;
}
