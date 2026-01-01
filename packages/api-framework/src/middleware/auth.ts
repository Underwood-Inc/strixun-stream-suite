/**
 * API Framework - Authentication Middleware
 * 
 * Handles authentication token injection and refresh
 */

import type { APIRequest, APIResponse, Middleware, NextFunction } from '../types';

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
        const authHeaderValue = `Bearer ${token}`;
        request.headers['Authorization'] = authHeaderValue;
        
        // Store token in metadata for response decryption
        // CRITICAL: If token is explicitly passed in metadata, use that instead (for session restore scenarios)
        if (!request.metadata) {
          request.metadata = {};
        }
        
        // If token is already in metadata (explicitly passed), verify it matches tokenGetter
        if (request.metadata.token && request.metadata.token !== token) {
          console.warn('[AuthMiddleware] Token mismatch detected:', {
            method: request.method,
            path: request.path,
            metadataTokenLength: request.metadata.token.length,
            tokenGetterTokenLength: token.length,
            metadataTokenPrefix: request.metadata.token.substring(0, 20) + '...',
            tokenGetterTokenPrefix: token.substring(0, 20) + '...',
            note: 'Explicitly passed token in metadata takes precedence - this may be intentional (e.g., session restore)'
          });
          // Use the explicitly passed token (from metadata) to ensure decryption works
          // Update Authorization header to match
          request.headers['Authorization'] = `Bearer ${request.metadata.token}`;
        } else {
          // No explicit token in metadata, use tokenGetter token
          request.metadata.token = token;
        }
        
        console.log('[AuthMiddleware] Token added to request:', { 
          method: request.method, 
          path: request.path, 
          hasToken: true,
          tokenLength: request.metadata.token.length,
          tokenPrefix: request.metadata.token.substring(0, 20) + '...',
          tokenSource: request.metadata.token === token ? 'tokenGetter' : 'metadata (explicit)'
        });
      } else {
        // No token from tokenGetter, but check if one was explicitly passed in metadata
        if (request.metadata?.token) {
          // Use the explicitly passed token
          if (!request.headers) {
            request.headers = {};
          }
          request.headers['Authorization'] = `Bearer ${request.metadata.token}`;
          console.log('[AuthMiddleware] Using explicitly passed token from metadata:', {
            method: request.method,
            path: request.path,
            tokenLength: request.metadata.token.length,
            tokenPrefix: request.metadata.token.substring(0, 20) + '...'
          });
        } else {
          console.warn('[AuthMiddleware] No token available for request:', { method: request.method, path: request.path });
        }
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
        console.log('[AuthMiddleware] 401 received, refreshing token...');
        await config.onTokenExpired();
        
        // Retry request with new token
        if (config.tokenGetter) {
          const newToken = await config.tokenGetter();
          console.log('[AuthMiddleware] Token after refresh:', { hasToken: !!newToken, method: request.method, path: request.path });
          if (newToken) {
            if (!request.headers) {
              request.headers = {};
            }
            request.headers['Authorization'] = `Bearer ${newToken}`;
            console.log('[AuthMiddleware] Retrying request with new token');
            return next(request);
          } else {
            console.error('[AuthMiddleware] No token available after refresh, cannot retry');
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


