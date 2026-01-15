/**
 * @strixun/error-utils - Type Guards
 * 
 * Runtime type checking utilities for error handling.
 */

import type {
    ApplicationError,
    RFC7807Error,
    RFC7807ErrorWithExtensions,
    HTTPStatusCode,
    ErrorCategory,
    ValidationError,
} from './types';
import { AppError } from './factory';

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Check if a value is an AppError instance
 */
export function isAppError(value: unknown): value is AppError {
    return value instanceof AppError;
}

/**
 * Check if a value conforms to ApplicationError interface
 */
export function isApplicationError(value: unknown): value is ApplicationError {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const error = value as Partial<ApplicationError>;
    
    return (
        typeof error.message === 'string' &&
        typeof error.status === 'number' &&
        typeof error.category === 'string' &&
        typeof error.code === 'string' &&
        typeof error.isOperational === 'boolean' &&
        typeof error.retryable === 'boolean' &&
        typeof error.timestamp === 'string'
    );
}

/**
 * Check if a value is an RFC 7807 error
 */
export function isRFC7807Error(value: unknown): value is RFC7807Error {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const error = value as Partial<RFC7807Error>;
    
    return (
        typeof error.type === 'string' &&
        typeof error.title === 'string' &&
        typeof error.status === 'number' &&
        typeof error.detail === 'string'
    );
}

/**
 * Check if a value is an RFC 7807 error with extensions
 */
export function isRFC7807ErrorWithExtensions(
    value: unknown
): value is RFC7807ErrorWithExtensions {
    return isRFC7807Error(value) && 
        'extensions' in (value as object) &&
        typeof (value as RFC7807ErrorWithExtensions).extensions === 'object';
}

/**
 * Check if a value is a ValidationError
 */
export function isValidationError(value: unknown): value is ValidationError {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const error = value as Partial<ValidationError>;
    
    return (
        typeof error.field === 'string' &&
        typeof error.message === 'string'
    );
}

/**
 * Check if an error is a native Error instance
 */
export function isNativeError(value: unknown): value is Error {
    return value instanceof Error;
}

// ============================================================================
// Status Code Guards
// ============================================================================

/**
 * Check if a status code is a valid HTTP status code
 */
export function isHTTPStatusCode(value: unknown): value is HTTPStatusCode {
    if (typeof value !== 'number') {
        return false;
    }
    
    return value >= 100 && value < 600 && Number.isInteger(value);
}

/**
 * Check if a status code indicates a client error (4xx)
 */
export function isClientError(status: number): boolean {
    return status >= 400 && status < 500;
}

/**
 * Check if a status code indicates a server error (5xx)
 */
export function isServerError(status: number): boolean {
    return status >= 500 && status < 600;
}

/**
 * Check if a status code indicates any error (4xx or 5xx)
 */
export function isErrorStatus(status: number): boolean {
    return status >= 400;
}

/**
 * Check if a status code indicates success (2xx)
 */
export function isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

/**
 * Check if an error is retryable based on status code
 */
export function isRetryableStatus(status: number): boolean {
    // 408: Request Timeout
    // 429: Too Many Requests
    // 502: Bad Gateway
    // 503: Service Unavailable
    // 504: Gateway Timeout
    return [408, 429, 502, 503, 504].includes(status);
}

// ============================================================================
// Category Guards
// ============================================================================

/**
 * Check if a string is a valid ErrorCategory
 */
export function isErrorCategory(value: unknown): value is ErrorCategory {
    if (typeof value !== 'string') {
        return false;
    }

    const categories: ErrorCategory[] = [
        'authentication',
        'authorization',
        'validation',
        'not_found',
        'conflict',
        'rate_limit',
        'server',
        'network',
        'timeout',
        'configuration',
        'external_service',
        'business_logic',
        'unknown',
    ];

    return categories.includes(value as ErrorCategory);
}

/**
 * Check if an error belongs to a specific category
 */
export function hasCategory(
    error: ApplicationError,
    category: ErrorCategory
): boolean {
    return error.category === category;
}

/**
 * Check if an error is an authentication error
 */
export function isAuthenticationError(error: ApplicationError): boolean {
    return error.category === 'authentication' || error.status === 401;
}

/**
 * Check if an error is an authorization error
 */
export function isAuthorizationError(error: ApplicationError): boolean {
    return error.category === 'authorization' || error.status === 403;
}

/**
 * Check if an error is a validation error
 */
export function isValidationErrorCategory(error: ApplicationError): boolean {
    return error.category === 'validation' || error.status === 422;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: ApplicationError): boolean {
    return error.category === 'not_found' || error.status === 404;
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: ApplicationError): boolean {
    return error.category === 'rate_limit' || error.status === 429;
}

/**
 * Check if an error is a server error
 */
export function isServerErrorCategory(error: ApplicationError): boolean {
    return error.category === 'server' || isServerError(error.status);
}

// ============================================================================
// Operational vs Programmer Error Guards
// ============================================================================

/**
 * Check if an error is operational (expected, can be handled gracefully)
 */
export function isOperationalError(error: ApplicationError): boolean {
    return error.isOperational === true;
}

/**
 * Check if an error is a programmer error (unexpected, bug in code)
 */
export function isProgrammerError(error: ApplicationError): boolean {
    return error.isOperational === false;
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: ApplicationError): boolean {
    return error.retryable === true;
}

// ============================================================================
// Response Body Guards
// ============================================================================

/**
 * Check if a response body contains validation errors
 */
export function hasValidationErrors(
    body: unknown
): body is { validationErrors: ValidationError[] } {
    if (!body || typeof body !== 'object') {
        return false;
    }

    const obj = body as { validationErrors?: unknown };
    
    return (
        Array.isArray(obj.validationErrors) &&
        obj.validationErrors.every(isValidationError)
    );
}

/**
 * Check if a response body has RFC 7807 extensions
 */
export function hasExtensions(
    body: unknown
): body is { extensions: Record<string, unknown> } {
    if (!body || typeof body !== 'object') {
        return false;
    }

    const obj = body as { extensions?: unknown };
    
    return obj.extensions !== undefined && typeof obj.extensions === 'object';
}

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Assert that a value is an ApplicationError
 * @throws Error if assertion fails
 */
export function assertApplicationError(
    value: unknown,
    message = 'Expected ApplicationError'
): asserts value is ApplicationError {
    if (!isApplicationError(value)) {
        throw new Error(message);
    }
}

/**
 * Assert that a value is an RFC 7807 error
 * @throws Error if assertion fails
 */
export function assertRFC7807Error(
    value: unknown,
    message = 'Expected RFC 7807 Error'
): asserts value is RFC7807Error {
    if (!isRFC7807Error(value)) {
        throw new Error(message);
    }
}

/**
 * Assert that a status code is valid
 * @throws Error if assertion fails
 */
export function assertHTTPStatusCode(
    value: unknown,
    message = 'Expected valid HTTP status code'
): asserts value is HTTPStatusCode {
    if (!isHTTPStatusCode(value)) {
        throw new Error(message);
    }
}
