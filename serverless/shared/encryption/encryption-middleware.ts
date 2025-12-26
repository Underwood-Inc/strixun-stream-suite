/**
 * Centralized Encryption Middleware
 * 
 * Industry-standard middleware that enforces per-route encryption policies.
 * This middleware wraps route handlers and ensures ALL responses are encrypted
 * according to the route's encryption policy.
 * 
 * Usage:
 * ```typescript
 * const encryptedResponse = await applyEncryptionMiddleware(
 *   handlerResponse,
 *   request,
 *   env,
 *   customPolicies // optional
 * );
 * ```
 */

import type { RouteEncryptionPolicy, EncryptionContext, EncryptionResult } from './route-encryption.js';
import {
  encryptResponse,
  createEncryptionContext,
  findMatchingPolicy,
  DEFAULT_ENCRYPTION_POLICIES,
} from './route-encryption.js';

// ============ Types ============

export interface EncryptionMiddlewareOptions {
  /** Custom encryption policies (merged with defaults) */
  policies?: RouteEncryptionPolicy[];
  /** Whether to log encryption failures (default: true) */
  logErrors?: boolean;
  /** Custom error handler */
  onEncryptionError?: (error: Error, context: EncryptionContext) => void;
}

// ============ Middleware ============

/**
 * Apply encryption middleware to a response
 * 
 * @param response - Original response from handler
 * @param request - HTTP request
 * @param env - Worker environment
 * @param options - Middleware options
 * @returns Encrypted response (or original if encryption not required/failed)
 */
export async function applyEncryptionMiddleware(
  response: Response,
  request: Request,
  env: any,
  options: EncryptionMiddlewareOptions = {}
): Promise<Response> {
  const {
    policies = [],
    logErrors = true,
    onEncryptionError,
  } = options;

  // Merge custom policies with defaults (custom policies take precedence)
  const allPolicies = [...DEFAULT_ENCRYPTION_POLICIES, ...policies];

  // Create encryption context
  const context = createEncryptionContext(request, env);

  // Find matching policy
  const policy = findMatchingPolicy(context.path, allPolicies, request);

  if (!policy) {
    // No policy found - this shouldn't happen due to catch-all, but handle gracefully
    if (logErrors) {
      console.warn(`No encryption policy found for route: ${context.path}`);
    }
    return response;
  }

  // Skip encryption if strategy is 'none'
  if (policy.strategy === 'none') {
    return response;
  }

  // Only encrypt successful JSON responses
  if (!response.ok) {
    return response;
  }

  // Check if response is JSON
  const contentType = response.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    // Not JSON - return as-is (could be HTML, binary, etc.)
    return response;
  }

  try {
    // Parse response data
    const responseData = await response.json();

    // Encrypt response
    const result: EncryptionResult = await encryptResponse(
      responseData,
      context,
      policy
    );

    if (!result.encrypted) {
      // Encryption failed or not required
      if (result.error) {
        if (policy.mandatory) {
          // Mandatory encryption failed - this is a security issue
          const error = new Error(
            `Mandatory encryption failed for route ${context.path}: ${result.error.message}`
          );
          
          if (onEncryptionError) {
            onEncryptionError(error, context);
          } else if (logErrors) {
            console.error('Mandatory encryption failed:', error);
          }

          // Return error response instead of unencrypted data
          return new Response(
            JSON.stringify({
              error: 'Encryption failed',
              code: 'ENCRYPTION_ERROR',
              message: 'Response could not be encrypted. Please try again.',
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(response.headers.entries()),
              },
            }
          );
        } else {
          // Optional encryption failed - log but return original
          if (logErrors) {
            console.warn(`Encryption failed for route ${context.path}:`, result.error);
          }
          return response;
        }
      }
      return response;
    }

    // Create encrypted response
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Encrypted', 'true');
    headers.set('X-Encryption-Strategy', result.strategy || 'unknown');

    return new Response(JSON.stringify(result.encryptedData), {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    if (policy.mandatory) {
      // Mandatory encryption - return error
      if (onEncryptionError) {
        onEncryptionError(err, context);
      } else if (logErrors) {
        console.error('Encryption middleware error:', err);
      }

      return new Response(
        JSON.stringify({
          error: 'Encryption failed',
          code: 'ENCRYPTION_ERROR',
          message: 'Response could not be encrypted. Please try again.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(response.headers.entries()),
          },
        }
      );
    } else {
      // Optional encryption - log and return original
      if (logErrors) {
        console.warn(`Encryption middleware error for route ${context.path}:`, err);
      }
      return response;
    }
  }
}

/**
 * Create a route handler wrapper that applies encryption middleware
 * 
 * @param handler - Original route handler
 * @param options - Encryption middleware options
 * @returns Wrapped handler with automatic encryption
 */
export function withEncryption<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  options: EncryptionMiddlewareOptions = {}
): T {
  return (async (...args: any[]) => {
    // Extract request and env from handler arguments
    // Assumes handler signature: (request: Request, env: any, ...) => Promise<Response>
    const request = args[0] as Request;
    const env = args[1] as any;

    // Call original handler
    const response = await handler(...args);

    // Apply encryption middleware
    return await applyEncryptionMiddleware(response, request, env, options);
  }) as T;
}

/**
 * Create encryption policies for a specific service
 * 
 * @param basePolicies - Base policies to extend
 * @param servicePolicies - Service-specific policies
 * @returns Merged policies (service policies take precedence)
 */
export function createServicePolicies(
  basePolicies: RouteEncryptionPolicy[],
  servicePolicies: RouteEncryptionPolicy[]
): RouteEncryptionPolicy[] {
  // Service policies override base policies
  return [...basePolicies, ...servicePolicies];
}

