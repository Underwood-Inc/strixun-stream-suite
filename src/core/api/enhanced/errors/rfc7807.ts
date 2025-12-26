/**
 * Enhanced API Framework - RFC 7807 Error Formatter
 * 
 * Formats errors according to RFC 7807 Problem Details for HTTP APIs
 */

import type { RFC7807Error } from '../types';
import type { APIRequest, APIError } from '../../types';

/**
 * Create RFC 7807 compliant error response
 */
export function createRFC7807Error(
  request: APIRequest,
  status: number,
  title: string,
  detail: string,
  additionalFields?: Record<string, any>
): RFC7807Error {
  const errorType = getErrorType(status);
  
  const error: RFC7807Error = {
    type: errorType,
    title,
    status,
    detail,
    instance: request.url || request.path,
    ...additionalFields,
  };

  return error;
}

/**
 * Get error type URI based on status code
 */
function getErrorType(status: number): string {
  const types: Record<number, string> = {
    400: 'https://tools.ietf.org/html/rfc7231#section-6.5.1', // Bad Request
    401: 'https://tools.ietf.org/html/rfc7235#section-3.1', // Unauthorized
    403: 'https://tools.ietf.org/html/rfc7231#section-6.5.3', // Forbidden
    404: 'https://tools.ietf.org/html/rfc7231#section-6.5.4', // Not Found
    409: 'https://tools.ietf.org/html/rfc7231#section-6.5.8', // Conflict
    429: 'https://tools.ietf.org/html/rfc6585#section-4', // Too Many Requests
    500: 'https://tools.ietf.org/html/rfc7231#section-6.6.1', // Internal Server Error
    502: 'https://tools.ietf.org/html/rfc7231#section-6.6.2', // Bad Gateway
    503: 'https://tools.ietf.org/html/rfc7231#section-6.6.4', // Service Unavailable
    504: 'https://tools.ietf.org/html/rfc7231#section-6.6.5', // Gateway Timeout
  };

  return types[status] || 'https://tools.ietf.org/html/rfc7231#section-6.6.1';
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
 */
function getErrorTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return titles[status] || 'Error';
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

