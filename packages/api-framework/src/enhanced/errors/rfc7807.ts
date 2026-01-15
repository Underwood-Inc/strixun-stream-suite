/**
 * Enhanced API Framework - RFC 7807 Error Formatter
 * 
 * Re-exports from @strixun/error-utils for backward compatibility.
 * New code should import directly from @strixun/error-utils.
 * 
 * @deprecated Import from '@strixun/error-utils' instead
 */

import {
    createRFC7807,
    getTypeUri,
    getTitle,
    buildWebResponse,
    RFC_TYPE_URIS,
    STATUS_TITLES,
    type RFC7807Error as ErrorUtilsRFC7807Error,
} from '@strixun/error-utils';

import type { RFC7807Error } from '../types';
import type { APIRequest, APIError } from '../../types';

// Re-export core utilities
export { RFC_TYPE_URIS, STATUS_TITLES };

/**
 * Create RFC 7807 compliant error response
 * 
 * @deprecated Use createRFC7807 from '@strixun/error-utils' instead
 */
export function createRFC7807Error(
    request: APIRequest,
    status: number,
    title: string,
    detail: string,
    additionalFields?: Record<string, unknown>
): RFC7807Error {
    const error = createRFC7807(status as Parameters<typeof createRFC7807>[0], detail, {
        type: getTypeUri(status),
        title,
        instance: request.url || request.path,
        extensions: additionalFields as Record<string, unknown>,
    });

    // Flatten extensions for backward compatibility
    return {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
        instance: error.instance,
        ...additionalFields,
    };
}

/**
 * Get error type URI based on status code
 * 
 * @deprecated Use getTypeUri from '@strixun/error-utils' instead
 */
function getErrorType(status: number): string {
    return getTypeUri(status);
}

/**
 * Convert APIError to RFC 7807 format
 */
export function formatErrorAsRFC7807(
    request: APIRequest,
    error: APIError
): RFC7807Error {
    const status = error.status || 500;
    const title = getErrorTitle(status);
    const detail = error.message || 'An error occurred';

    return createRFC7807Error(
        request,
        status,
        title,
        detail,
        {
            ...(error.data && typeof error.data === 'object' && error.data !== null ? error.data : {}),
            retry_after: error.retryAfter,
            retryable: error.retryable,
        }
    );
}

/**
 * Get error title based on status code
 * 
 * @deprecated Use getTitle from '@strixun/error-utils' instead
 */
function getErrorTitle(status: number): string {
    return getTitle(status);
}

/**
 * Create Response with RFC 7807 error
 */
export function createRFC7807Response(
    request: APIRequest,
    error: APIError | RFC7807Error,
    headers?: Headers
): Response {
    const rfc7807Error = 'type' in error
        ? error as RFC7807Error
        : formatErrorAsRFC7807(request, error as APIError);

    const responseHeaders = new Headers(headers);
    responseHeaders.set('Content-Type', 'application/problem+json');

    // Add Retry-After header if present
    if (rfc7807Error.retry_after) {
        responseHeaders.set('Retry-After', rfc7807Error.retry_after.toString());
    }

    return new Response(
        JSON.stringify(rfc7807Error),
        {
            status: rfc7807Error.status,
            headers: responseHeaders,
        }
    );
}
