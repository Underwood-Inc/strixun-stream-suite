/**
 * Enhanced API Framework - Middleware Composition
 * 
 * Utilities for composing server-side middleware in Cloudflare Workers
 */

import type { Middleware } from '../../types';
import type { RequestContext } from '../types';

export interface ServerMiddleware {
  (request: Request, context: RequestContext, next: () => Promise<Response>): Promise<Response>;
}

/**
 * Compose multiple server middlewares into one
 */
export function composeServerMiddlewares(
  ...middlewares: ServerMiddleware[]
): ServerMiddleware {
  return async (request: Request, context: RequestContext, next: () => Promise<Response>): Promise<Response> => {
    let index = 0;

    const dispatch = async (): Promise<Response> => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      return middleware(request, context, dispatch);
    };

    return dispatch();
  };
}

/**
 * Create middleware from enhanced middleware
 */
export function createServerMiddleware(
  middleware: Middleware
): ServerMiddleware {
  return async (request: Request, context: RequestContext, next: () => Promise<Response>): Promise<Response> => {
    // Convert Request to APIRequest
    const apiRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method: request.method as any,
      url: request.url,
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers.entries()),
    };

    // Execute middleware
    const response = await middleware(apiRequest, async (req) => {
      // Call next middleware/handler
      const nextResponse = await next();
      
      // Convert Response to APIResponse
      return {
        data: await nextResponse.json(),
        status: nextResponse.status,
        statusText: nextResponse.statusText,
        headers: nextResponse.headers,
        request: apiRequest,
        timestamp: Date.now(),
      };
    });

    // Convert APIResponse back to Response
    return new Response(
      JSON.stringify(response.data),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }
    );
  };
}

/**
 * Apply middleware to handler
 */
export function withMiddleware(
  handler: (request: Request, context: RequestContext) => Promise<Response>,
  ...middlewares: ServerMiddleware[]
): (request: Request, context: RequestContext) => Promise<Response> {
  const composed = composeServerMiddlewares(...middlewares);

  return async (request: Request, context: RequestContext): Promise<Response> => {
    return composed(request, context, async () => {
      return handler(request, context);
    });
  };
}

