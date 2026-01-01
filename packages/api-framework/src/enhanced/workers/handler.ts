/**
 * Enhanced API Framework - Server-Side Request Handler
 * 
 * Utilities for handling requests in Cloudflare Workers with enhanced features
 */

// @ts-ignore - Conditional type reference
/// <reference types="@cloudflare/workers-types" />

import type { RequestContext, TypeDefinition, ResponseFilterConfig } from '../types';
import type { APIRequest } from '../../types';
import { buildResponse } from '../building/response-builder';
import { createRFC7807Response } from '../errors';
import { applyFiltering, parseFilteringParams } from '../filtering';
import { WorkerAdapter } from './adapter';
import { encryptWithJWT } from '../encryption';

export interface HandlerOptions {
  typeDef?: TypeDefinition;
  filterConfig?: ResponseFilterConfig;
  requireAuth?: boolean;
  cors?: boolean;
}

export interface HandlerContext extends RequestContext {
  adapter?: WorkerAdapter;
}

/**
 * Create enhanced request handler
 * 
 * Wraps a handler function with enhanced features:
 * - Response building (root config, type safety)
 * - Response filtering
 * - Error handling (RFC 7807)
 * - CORS support
 */
export function createEnhancedHandler<T extends Record<string, any> = Record<string, any>>(
  handler: (request: Request, context: HandlerContext) => Promise<T>,
  options: HandlerOptions = {}
) {
  return async (
    request: Request,
    env: any,
    _ctx: ExecutionContext
  ): Promise<Response> => {
    try {
      // Create adapter
      const adapter = new WorkerAdapter({
        env,
        cors: options.cors ?? true,
      });

      // Build request context
      const context: HandlerContext = {
        request: requestToAPIRequest(request),
        env,
        adapter,
      };

      // Check authentication if required
      if (options.requireAuth) {
        const user = await extractUserFromRequest(request, env);
        if (!user) {
          return createRFC7807Response(
            context.request,
            {
              status: 401,
              message: 'Unauthorized',
            } as any,
            new Headers()
          );
        }
        context.user = user;
      }

      // Execute handler
      const data = await handler(request, context);

      // Build response with root config
      const built = buildResponse<T>(
        data as Partial<T>,
        context,
        options.typeDef,
        {
          include: parseFilteringParams(context.request).include,
          exclude: parseFilteringParams(context.request).exclude,
          tags: parseFilteringParams(context.request).tags,
        }
      );

      // Apply filtering if config provided
      let filteredData = built.data;
      if (options.filterConfig) {
        const params = parseFilteringParams(context.request);
        filteredData = applyFiltering(
          filteredData,
          params,
          options.filterConfig,
          options.typeDef
        );
      }

      // Create response
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');

      // Add CORS headers if enabled
      if (options.cors && adapter) {
        // CORS is handled by the adapter if needed
        // Headers are added automatically by the adapter
      }

      // Automatically encrypt response if JWT token is present
      let responseData = filteredData;
      let responseHeaders = headers;
      
      if (context.user) {
        // Extract JWT token from request
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        
        if (token && token.length >= 10) {
          try {
            // Encrypt response data
            const encrypted = await encryptWithJWT(responseData, token);
            responseData = encrypted as any;
            responseHeaders.set('X-Encrypted', 'true');
          } catch (error) {
            console.error('Failed to encrypt response:', error);
            // Continue with unencrypted response if encryption fails
          }
        }
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: responseHeaders,
      });
    } catch (error: any) {
      // Handle errors with RFC 7807
      const apiRequest = requestToAPIRequest(request);
      const apiError = error.status
        ? error
        : {
            status: 500,
            message: error.message || 'Internal Server Error',
          };

      return createRFC7807Response(apiRequest, apiError, new Headers());
    }
  };
}

/**
 * Convert Fetch Request to APIRequest
 */
function requestToAPIRequest(request: Request): APIRequest {
  const url = new URL(request.url);
  
  return {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    method: request.method as any,
    url: request.url,
    path: url.pathname,
    params: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(request.headers.entries()),
  };
}

/**
 * Extract user from request (JWT token)
 */
async function extractUserFromRequest(
  request: Request,
  _env: any
): Promise<{ id: string; customerId: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // CRITICAL: Trim token to ensure it matches the token used for encryption
  const token = authHeader.substring(7).trim();
  
  try {
    // Decode JWT (simplified - in production, verify signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    
    return {
      id: payload.sub || payload.userId || '',
      customerId: payload.customerId || payload.aud || '',
      email: payload.email || '',
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create simple GET handler
 */
export function createGetHandler<T extends Record<string, any> = Record<string, any>>(
  handler: (request: Request, context: HandlerContext) => Promise<T>,
  options: HandlerOptions = {}
) {
  return createEnhancedHandler<T>(handler, options);
}

/**
 * Create simple POST handler
 */
export function createPostHandler<T extends Record<string, any> = Record<string, any>>(
  handler: (request: Request, context: HandlerContext) => Promise<T>,
  options: HandlerOptions = {}
) {
  return createEnhancedHandler<T>(handler, options);
}

