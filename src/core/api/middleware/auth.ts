/**
 * API Framework - Authentication Middleware
 * 
 * Handles authentication token injection and refresh
 */

import type { APIRequest, APIResponse, Middleware, NextFunction } from '../types';
import { createError, handleErrorResponse } from '../utils/response-handler';

export interface AuthMiddlewareConfig {
  tokenGetter?: () => string | null | Promise<string | null>;
  csrfTokenGetter?: () => string | null | Promise<string | null>;
  onTokenExpired?: () => void | Promise<void>;
  baseURL?: string;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): Middleware {
  return async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    // Skip auth for endpoints that don't require it
    if (request.metadata?.auth === false) {
      return next(request);
    }

    // Get auth token
    if (config.tokenGetter) {
      const token = await config.tokenGetter();
      if (token) {
        if (!request.headers) {
          request.headers = {};
        }
        request.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Add CSRF token for state-changing operations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      if (config.csrfTokenGetter) {
        const csrfToken = await config.csrfTokenGetter();
        if (csrfToken) {
          if (!request.headers) {
            request.headers = {};
          }
          request.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    }

    try {
      const response = await next(request);

      // Handle token expiration (401)
      if (response.status === 401 && config.onTokenExpired) {
        await config.onTokenExpired();
        
        // Retry request with new token
        if (config.tokenGetter) {
          const newToken = await config.tokenGetter();
          if (newToken) {
            if (!request.headers) {
              request.headers = {};
            }
            request.headers['Authorization'] = `Bearer ${newToken}`;
            return next(request);
          }
        }
      }

      return response;
    } catch (error) {
      // Handle 401 errors
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        if (config.onTokenExpired) {
          await config.onTokenExpired();
          
          // Retry request with new token
          if (config.tokenGetter) {
            const newToken = await config.tokenGetter();
            if (newToken) {
              if (!request.headers) {
                request.headers = {};
              }
              request.headers['Authorization'] = `Bearer ${newToken}`;
              try {
                return await next(request);
              } catch (retryError) {
                throw retryError;
              }
            }
          }
        }
      }
      throw error;
    }
  };
}

