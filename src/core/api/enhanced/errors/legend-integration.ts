/**
 * Enhanced API Framework - Error Legend Integration
 * 
 * Integrates with error legend system for comprehensive error information
 */

import type { RFC7807Error } from '../types';
import type { APIRequest, APIError } from '../../types';

// Import error legend from shared-components
// Using relative path from src/core/api/enhanced/errors to shared-components
import { getErrorInfo as getErrorInfoFromLegend } from '../../../../../shared-components/error-mapping/error-legend';

/**
 * Enhance RFC 7807 error with error legend information
 */
export function enhanceErrorWithLegend(
  error: RFC7807Error | APIError,
  request: APIRequest
): RFC7807Error {
  const errorCode = 'code' in error ? error.code : error.status?.toString() || '500';
  const errorInfo = getErrorInfoFromLegend(errorCode);

  // If already RFC 7807, enhance it
  if ('type' in error) {
    const rfc7807Error = error as RFC7807Error;
    return {
      ...rfc7807Error,
      title: errorInfo.title || rfc7807Error.title,
      detail: errorInfo.description || rfc7807Error.detail,
      error_code: errorCode,
      error_info: {
        details: errorInfo.details,
        suggestion: errorInfo.suggestion,
      },
    };
  }

  // Convert APIError to RFC 7807
  const apiError = error as APIError;
  return {
    type: `https://tools.ietf.org/html/rfc7231#section-6.6.1`,
    title: errorInfo.title,
    status: apiError.status || 500,
    detail: errorInfo.description || apiError.message || 'An error occurred',
    instance: request.url || request.path,
    error_code: errorCode,
    error_info: {
      details: errorInfo.details,
      suggestion: errorInfo.suggestion,
    },
    ...(apiError.data && typeof apiError.data === 'object' && apiError.data !== null ? apiError.data : {}),
  };
}

/**
 * Create error middleware with legend integration
 */
export function createErrorLegendMiddleware(
  useErrorLegend: boolean = true
) {
  return async (
    request: APIRequest,
    next: (request: APIRequest) => Promise<any>
  ): Promise<any> => {
    try {
      return await next(request);
    } catch (error) {
      if (!useErrorLegend) {
        throw error;
      }

      // Enhance error with legend
      const enhancedError = enhanceErrorWithLegend(error as APIError, request);
      throw enhancedError;
    }
  };
}

