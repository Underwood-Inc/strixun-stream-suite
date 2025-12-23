/**
 * API Framework - Error Handling Middleware
 * 
 * Centralized error handling and transformation
 */

import type { APIRequest, APIResponse, APIError, Middleware, NextFunction } from '../types';
import { createError, extractErrorMessage } from '../utils/response-handler';

export interface ErrorHandlerConfig {
  handler?: (error: APIError, request: APIRequest) => Promise<APIResponse | void>;
  transformError?: (error: APIError) => APIError;
}

/**
 * Create error handling middleware
 */
export function createErrorMiddleware(config: ErrorHandlerConfig = {}): Middleware {
  return async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    try {
      return await next(request);
    } catch (error) {
      let apiError: APIError;

      // Convert to APIError if needed
      if (error && typeof error === 'object' && 'status' in error) {
        apiError = error as APIError;
      } else {
        apiError = createError(
          request,
          undefined,
          undefined,
          extractErrorMessage(error),
          error
        );
      }

      // Transform error if handler provided
      if (config.transformError) {
        apiError = config.transformError(apiError);
      }

      // Call custom error handler
      if (config.handler) {
        const result = await config.handler(apiError, request);
        if (result) {
          return result;
        }
      }

      // Re-throw if not handled
      throw apiError;
    }
  };
}


