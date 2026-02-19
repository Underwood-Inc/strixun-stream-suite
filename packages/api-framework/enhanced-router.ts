/**
 * Enhanced Router Wrapper
 * 
 * Wraps existing router functions with enhanced framework features
 */

import { createErrorResponse, createEnhancedResponse, extractCustomerFromRequest } from './enhanced-wrapper';
import type { ExecutionContext } from '@strixun/types';

interface EnhancedContext {
  customer?: {
    id: string;
    customerId: string;
  };
}

/**
 * Wrap router response with enhanced features
 */
export async function enhanceRouterResponse(response: Response, request: Request, env: any, context: EnhancedContext = {}): Promise<Response> {
  // If not a Response object, return as-is
  if (!(response instanceof Response)) {
    return response as any;
  }

  // Extract customer from request if not provided
  if (!context.customer) {
    const extractedCustomer = await extractCustomerFromRequest(request, env);
    context.customer = extractedCustomer || undefined;
  }

  // For JSON responses, add root config
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      const data = await response.json();
      
      // Clone response to avoid "body already read" error
      const enhancedData = createEnhancedResponse(data, context);
      
      // Create new response with enhanced data
      return new Response(JSON.stringify(enhancedData), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      // If JSON parsing fails, return original response
      return response;
    }
  }

  return response;
}

/**
 * Wrap router error with RFC 7807 format
 */
export function enhanceRouterError(error: any, request: Request, env: any, status = 500): Response {
  return createErrorResponse(request, error, status);
}

type RouterFunction = (request: Request, env: any, ctx?: ExecutionContext) => Promise<Response>;

/**
 * Enhanced router wrapper
 * 
 * Wraps existing router function with enhanced features
 */
export function createEnhancedRouter(originalRouter: RouterFunction): RouterFunction {
  return async (request: Request, env: any, ctx?: ExecutionContext) => {
    try {
      // Call original router
      const response = await originalRouter(request, env, ctx);
      
      // Enhance response
      return await enhanceRouterResponse(response, request, env);
    } catch (error: any) {
      // Log error for debugging
      console.error('[Enhanced Router] Unhandled error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        url: request.url,
        method: request.method,
      });
      
      // Enhance error
      return enhanceRouterError(error, request, env);
    }
  };
}

