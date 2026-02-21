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
    // This ensures that when a token is explicitly passed (e.g., from fetchCustomerInfo),
    // it takes precedence and both Authorization header and metadata.token use the same token
    if (!request.metadata) {
      request.metadata = {};
    }
    
    let tokenToUse: string | null = null;
    
    // Priority 1: Explicitly passed token in metadata (for fetchCustomerInfo, etc.)
    if (request.metadata.token && typeof request.metadata.token === 'string' && request.metadata.token.trim().length > 0) {
      const rawMetadataToken = request.metadata.token;
      tokenToUse = rawMetadataToken.trim();
      const wasTrimmed = rawMetadataToken !== tokenToUse;
      
      console.log('[AuthMiddleware] Using explicitly passed token from metadata:', {
        method: request.method,
        path: request.path,
        rawTokenLength: rawMetadataToken.length,
        trimmedTokenLength: tokenToUse.length,
        wasTrimmed,
        rawTokenPrefix: rawMetadataToken.substring(0, 20) + '...',
        trimmedTokenPrefix: tokenToUse.substring(0, 20) + '...',
        rawTokenSuffix: '...' + rawMetadataToken.substring(rawMetadataToken.length - 10),
        trimmedTokenSuffix: '...' + tokenToUse.substring(tokenToUse.length - 10),
        source: 'metadata (explicit)'
      });
    } 
    // Priority 2: Token from tokenGetter (if no explicit token in metadata)
    else if (config.tokenGetter) {
      const tokenFromGetter = await config.tokenGetter();
      if (tokenFromGetter && typeof tokenFromGetter === 'string' && tokenFromGetter.trim().length > 0) {
        const rawGetterToken = tokenFromGetter;
        tokenToUse = rawGetterToken.trim();
        const wasTrimmed = rawGetterToken !== tokenToUse;
        
        // Store in metadata for response decryption
        request.metadata.token = tokenToUse;
        console.log('[AuthMiddleware] Using token from tokenGetter:', {
          method: request.method,
          path: request.path,
          rawTokenLength: rawGetterToken.length,
          trimmedTokenLength: tokenToUse.length,
          wasTrimmed,
          rawTokenPrefix: rawGetterToken.substring(0, 20) + '...',
          trimmedTokenPrefix: tokenToUse.substring(0, 20) + '...',
          rawTokenSuffix: '...' + rawGetterToken.substring(rawGetterToken.length - 10),
          trimmedTokenSuffix: '...' + tokenToUse.substring(tokenToUse.length - 10),
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
        tokenSuffix: '...' + tokenToUse.substring(tokenToUse.length - 10),
        authHeaderSet: !!request.headers['Authorization'],
        authHeaderValue: request.headers['Authorization'] ? request.headers['Authorization'].substring(0, 27) + '...' : 'none',
        metadataTokenSet: !!request.metadata.token,
        metadataTokenLength: (request.metadata.token && typeof request.metadata.token === 'string') ? request.metadata.token.length : 0,
        metadataTokenPrefix: (request.metadata.token && typeof request.metadata.token === 'string') ? request.metadata.token.substring(0, 20) + '...' : 'none',
        tokensMatch: request.headers['Authorization'] === `Bearer ${request.metadata.token}`,
        tokensEqual: tokenToUse === request.metadata.token
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
        console.log('[AuthMiddleware] 401 received, attempting refresh...');
        await config.onTokenExpired();
        // Retry: with tokenGetter use new token; with cookie auth (no tokenGetter) retry so new Set-Cookie is sent
        if (config.tokenGetter) {
          const newToken = await config.tokenGetter();
          if (newToken) {
            if (!request.headers) request.headers = {};
            request.headers['Authorization'] = `Bearer ${newToken}`;
            return next(request);
          }
        } else {
          // Cookie-based auth: refresh sets new cookies; retry sends them via credentials: 'include'
          return next(request);
        }
      }

      return response;
    } catch (error) {
      // Handle 401 errors (e.g. thrown by fetch layer)
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        if (config.onTokenExpired) {
          await config.onTokenExpired();
          if (config.tokenGetter) {
            const newToken = await config.tokenGetter();
            if (newToken) {
              if (!request.headers) request.headers = {};
              request.headers['Authorization'] = `Bearer ${newToken}`;
              return await next(request);
            }
          } else {
            return await next(request);
          }
        }
      }
      throw error;
    }
  };
}


