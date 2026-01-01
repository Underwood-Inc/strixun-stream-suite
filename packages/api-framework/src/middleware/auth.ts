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

    // CRITICAL: Check for explicitly passed token in metadata FIRST
    // This ensures that when a token is explicitly passed (e.g., from restoreSession),
    // it takes precedence and both Authorization header and metadata.token use the same token
    if (!request.metadata) {
      request.metadata = {};
    }
    
    let tokenToUse: string | null = null;
    
    // Priority 1: Explicitly passed token in metadata (for session restore, fetchUserInfo, etc.)
    if (request.metadata.token && typeof request.metadata.token === 'string' && request.metadata.token.trim().length > 0) {
      tokenToUse = request.metadata.token.trim();
      console.log('[AuthMiddleware] Using explicitly passed token from metadata:', {
        method: request.method,
        path: request.path,
        tokenLength: tokenToUse.length,
        tokenPrefix: tokenToUse.substring(0, 20) + '...',
        source: 'metadata (explicit)'
      });
    } 
    // Priority 2: Token from tokenGetter (if no explicit token in metadata)
    else if (config.tokenGetter) {
      const tokenFromGetter = await config.tokenGetter();
      if (tokenFromGetter && typeof tokenFromGetter === 'string' && tokenFromGetter.trim().length > 0) {
        tokenToUse = tokenFromGetter.trim();
        // Store in metadata for response decryption
        request.metadata.token = tokenToUse;
        console.log('[AuthMiddleware] Using token from tokenGetter:', {
          method: request.method,
          path: request.path,
          tokenLength: tokenToUse.length,
          tokenPrefix: tokenToUse.substring(0, 20) + '...',
          source: 'tokenGetter'
        });
      }
    }
    
    // Set Authorization header and ensure metadata.token matches
    if (tokenToUse) {
      if (!request.headers) {
        request.headers = {};
      }
      request.headers['Authorization'] = `Bearer ${tokenToUse}`;
      // CRITICAL: Ensure metadata.token matches Authorization header token
      // This prevents token mismatches during decryption
      request.metadata.token = tokenToUse;
      
      console.log('[AuthMiddleware] Token set for request:', { 
        method: request.method, 
        path: request.path, 
        hasToken: true,
        tokenLength: tokenToUse.length,
        tokenPrefix: tokenToUse.substring(0, 20) + '...',
        authHeaderSet: !!request.headers['Authorization'],
        metadataTokenSet: !!request.metadata.token,
        tokensMatch: request.headers['Authorization'] === `Bearer ${request.metadata.token}`
      });
    } else {
      console.warn('[AuthMiddleware] No token available for request:', { method: request.method, path: request.path });
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


