/**
 * API Framework - Response Handler
 * 
 * Utility for handling and transforming API responses
 */

import type { APIRequest, APIResponse, APIError } from '../types';

/**
 * Parse response and create APIResponse object
 */
export async function handleResponse<T = unknown>(
  request: APIRequest,
  response: Response
): Promise<APIResponse<T>> {
  let data: T;
  const contentType = response.headers.get('content-type');

  try {
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('text/')) {
      data = (await response.text()) as unknown as T;
    } else {
      data = (await response.arrayBuffer()) as unknown as T;
    }
  } catch (error) {
    throw createError(
      request,
      response.status,
      response.statusText,
      'Failed to parse response',
      error
    );
  }

  const apiResponse: APIResponse<T> = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    request,
    timestamp: Date.now(),
  };

  return apiResponse;
}

/**
 * Create API error from response
 */
export async function handleErrorResponse(
  request: APIRequest,
  response: Response
): Promise<APIError> {
  let errorData: unknown;
  const contentType = response.headers.get('content-type');

  try {
    if (contentType?.includes('application/json')) {
      errorData = await response.json();
    } else {
      errorData = await response.text();
    }
  } catch {
    errorData = null;
  }

  const error = createError(
    request,
    response.status,
    response.statusText,
    typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as { error: unknown }).error)
      : String(errorData || response.statusText),
    errorData
  );

  // Determine if error is retryable
  error.retryable = isRetryableError(response.status);
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      error.retryAfter = parseInt(retryAfter, 10) * 1000; // Convert to milliseconds
    }
  }

  return error;
}

/**
 * Create API error object
 */
export function createError(
  request: APIRequest,
  status?: number,
  statusText?: string,
  message?: string,
  data?: unknown
): APIError {
  const error = new Error(message || statusText || 'API request failed') as APIError;
  error.status = status;
  error.statusText = statusText;
  error.data = data;
  error.request = request;
  error.name = 'APIError';
  return error;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(status?: number): boolean {
  if (!status) return false;
  
  // Network errors and server errors are retryable
  // Client errors (4xx) are generally not retryable except for specific cases
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504    // Gateway Timeout
  );
}

/**
 * Check if response indicates success
 */
export function isSuccessResponse(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Extract error message from error data
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  return 'Unknown error';
}


