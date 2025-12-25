/**
 * Enhanced Framework Wrapper
 * 
 * Utilities to wrap existing handlers with enhanced framework features
 * Maintains backward compatibility while adding enhanced features
 */

import { createEnhancedHandler, createRFC7807Response } from '../../../src/core/api/enhanced/index.js';
import { getTypeRegistry } from '../../../src/core/api/enhanced/registry/index.js';
import { initializeServiceTypes, getServiceFilterConfig } from './types.js';

// Initialize types on import
let typesInitialized = false;

function ensureTypesInitialized() {
  if (!typesInitialized) {
    initializeServiceTypes();
    typesInitialized = true;
  }
}

/**
 * Wrap existing handler with enhanced features
 * 
 * @param {Function} originalHandler - Original handler function
 * @param {Object} options - Enhanced handler options
 * @returns {Function} Enhanced handler
 */
export function wrapWithEnhanced(originalHandler, options = {}) {
  ensureTypesInitialized();

  return createEnhancedHandler(
    async (request, context) => {
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

/**
 * Create enhanced response with root config
 */
export function createEnhancedResponse(data, context, typeName) {
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
export function createErrorResponse(request, error, status = 500) {
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
  
  return createRFC7807Response(apiRequest, apiError, new Headers());
}

/**
 * Extract user from request (JWT token)
 */
export async function extractUserFromRequest(request, env) {
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
function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

