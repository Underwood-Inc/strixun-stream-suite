/**
 * Enhanced Framework Wrapper
 * 
 * Utilities to wrap existing handlers with enhanced framework features
 * Maintains backward compatibility while adding enhanced features
 */

import { initializeServiceTypes, getServiceFilterConfig, getTypeRegistry } from './types.js';

interface EnhancedHandlerOptions {
  typeName?: string;
  requireAuth?: boolean;
  cors?: boolean;
}

interface Context {
  env: any;
  user?: {
    id: string;
    customerId: string;
    email?: string;
  };
}

/**
 * Create enhanced handler (stub - returns handler as-is)
 */
function createEnhancedHandler(handler: (request: Request, context: Context) => Promise<any>, options: EnhancedHandlerOptions = {}) {
  return async (request: Request, context: Context) => {
    return await handler(request, context);
  };
}

/**
 * Create RFC 7807 error response
 */
function createRFC7807Response(request: Request, error: any, headers: Headers): Response {
  let url: URL;
  try {
    url = new URL(request.url || 'http://localhost/');
  } catch (e) {
    url = new URL('http://localhost/');
  }
  
  const problem = {
    type: 'about:blank',
    title: error.message || 'Internal Server Error',
    status: error.status || 500,
    detail: error.message || 'An error occurred',
    instance: url.pathname,
    ...(error.data || {}),
  };

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/problem+json');
  
  if (headers && headers.entries) {
    for (const [key, value] of headers.entries()) {
      responseHeaders.set(key, value);
    }
  }

  return new Response(JSON.stringify(problem), {
    status: error.status || 500,
    headers: responseHeaders,
  });
}

// Initialize types on import
let typesInitialized = false;

function ensureTypesInitialized(): void {
  if (!typesInitialized) {
    initializeServiceTypes();
    typesInitialized = true;
  }
}

/**
 * Wrap existing handler with enhanced features
 */
export function wrapWithEnhanced(originalHandler: (request: Request, env: any, context?: any) => Promise<Response | any>, options: EnhancedHandlerOptions = {}) {
  ensureTypesInitialized();

  return createEnhancedHandler(
    async (request: Request, context: Context) => {
      // Call original handler
      const response = await originalHandler(request, context.env, context);
      
      // If response is already a Response object, extract data
      if (response instanceof Response) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json();
            return data;
          } catch (error) {
            // Not JSON, return as-is
            return { success: false, message: 'Invalid response format' };
          }
        }
        // Not JSON response, return error
        return { success: false, message: 'Non-JSON response' };
      }
      
      // If response is already data object, return it
      return response;
    },
    {
      typeDef: options.typeName ? getTypeRegistry().get(options.typeName) : undefined,
      filterConfig: getServiceFilterConfig(),
      requireAuth: options.requireAuth ?? false,
      cors: options.cors ?? true,
    }
  );
}

interface EnhancedResponseContext {
  user?: {
    id?: string;
    customerId?: string;
  };
}

/**
 * Create enhanced response with root config
 */
export function createEnhancedResponse(data: any, context: EnhancedResponseContext = {}, typeName?: string): any {
  ensureTypesInitialized();
  
  const registry = getTypeRegistry();
  const typeDef = typeName ? registry.get(typeName) : undefined;
  
  // Ensure root config is present
  const rootConfig = {
    id: data.id || context.user?.id || generateId(),
    customerId: data.customerId || context.user?.customerId || '',
  };
  
  return {
    ...rootConfig,
    ...data,
  };
}

/**
 * Create error response with RFC 7807 format
 */
export function createErrorResponse(request: Request, error: any, status = 500): Response {
  // Log error details for debugging
  console.error('[Error Response]', {
    status: error.status || status,
    message: error.message || 'Internal Server Error',
    stack: error.stack,
    url: request.url,
    method: request.method,
    path: new URL(request.url).pathname,
  });
  
  const apiRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    method: request.method,
    url: request.url,
    path: new URL(request.url).pathname,
    headers: Object.fromEntries(request.headers.entries()),
  };
  
  const apiError = {
    status: error.status || status,
    message: error.message || 'Internal Server Error',
    data: error.data || {},
  };
  
  return createRFC7807Response(apiRequest as any, apiError, new Headers());
}

interface User {
  id: string;
  customerId: string;
  email?: string;
}

/**
 * Extract user from request (JWT token)
 */
export async function extractUserFromRequest(request: Request, env: any): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
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
 * Generate unique ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

