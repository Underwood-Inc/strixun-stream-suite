/**
 * API Framework - Request/Response Transformation Middleware
 * 
 * Handles request/response data transformation
 */

import type { APIRequest, APIResponse, Middleware, NextFunction } from '../types';

export interface TransformConfig {
  transformRequest?: (request: APIRequest) => APIRequest | Promise<APIRequest>;
  transformResponse?: <T>(response: APIResponse<T>) => APIResponse<T> | Promise<APIResponse<T>>;
}

/**
 * Create transformation middleware
 */
export function createTransformMiddleware(config: TransformConfig): Middleware {
  return async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    // Transform request
    let transformedRequest = request;
    if (config.transformRequest) {
      transformedRequest = await config.transformRequest(request);
    }

    // Execute request
    const response = await next(transformedRequest);

    // Transform response
    if (config.transformResponse) {
      return config.transformResponse(response);
    }

    return response;
  };
}

/**
 * Default request transformer - ensures Content-Type header for JSON bodies
 */
export function defaultRequestTransformer(request: APIRequest): APIRequest {
  if (request.body && typeof request.body === 'object') {
    if (!request.headers) {
      request.headers = {};
    }
    if (!request.headers['Content-Type']) {
      request.headers['Content-Type'] = 'application/json';
    }
  }
  return request;
}

/**
 * Default response transformer - no transformation
 */
export function defaultResponseTransformer<T>(response: APIResponse<T>): APIResponse<T> {
  return response;
}

