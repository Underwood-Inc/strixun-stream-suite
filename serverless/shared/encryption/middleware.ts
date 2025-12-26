/**
 * Router Middleware for Automatic Encryption
 * 
 * Provides reusable middleware for automatically encrypting API responses
 * when JWT tokens are present in the request.
 */

import type { EncryptionWrapperOptions } from './types.js';
import { encryptWithJWT } from './jwt-encryption.js';

/**
 * Route result interface
 */
export interface RouteResult {
  response: Response;
  customerId: string | null;
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  customerId: string | null;
  jwtToken?: string;
  userId?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Create an encryption wrapper for route handlers
 * 
 * This wrapper automatically encrypts responses when:
 * - JWT token is present in auth object
 * - Response is OK (status 200-299)
 * - Response is JSON
 * 
 * @param handler - Route handler function
 * @param options - Optional encryption configuration
 * @returns Wrapped handler that automatically encrypts responses
 * 
 * @example
 * ```typescript
 * async function handleRoute(request: Request, env: Env, auth: AuthResult) {
 *   return new Response(JSON.stringify({ data: 'secret' }), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }
 * 
 * const wrappedHandler = createEncryptionWrapper(handleRoute);
 * // Now responses are automatically encrypted if JWT token is present
 * ```
 */
export function createEncryptionWrapper<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  options?: EncryptionWrapperOptions
): (...args: Parameters<T>) => Promise<RouteResult> {
  return async (...args: Parameters<T>): Promise<RouteResult> => {
    // Execute handler
    const response = await handler(...args);

    // Extract auth from arguments (typically second or third argument)
    let auth: AuthResult | undefined;
    for (const arg of args) {
      if (arg && typeof arg === 'object' && ('jwtToken' in arg || 'customerId' in arg)) {
        auth = arg as AuthResult;
        break;
      }
    }

    // Check if encryption is enabled
    const enabled = options?.enabled !== false;
    if (!enabled) {
      return {
        response,
        customerId: auth?.customerId || null,
      };
    }

    // Check if we should encrypt
    const shouldEncrypt = options?.shouldEncrypt
      ? options.shouldEncrypt(response)
      : response.ok && auth?.jwtToken;

    if (!shouldEncrypt || !auth?.jwtToken) {
      return {
        response,
        customerId: auth?.customerId || null,
      };
    }

    // Encrypt response
    try {
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        // Not JSON, don't encrypt
        return {
          response,
          customerId: auth.customerId || null,
        };
      }

      // Parse response data
      const responseData = await response.json();

      // Encrypt data
      const encrypted = await encryptWithJWT(responseData, auth.jwtToken);

      // Create new response with encrypted data
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response

      return {
        response: new Response(JSON.stringify(encrypted), {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
        }),
        customerId: auth.customerId || null,
      };
    } catch (error) {
      console.error('Failed to encrypt response:', error);
      // Return unencrypted response if encryption fails
      return {
        response,
        customerId: auth.customerId || null,
      };
    }
  };
}

/**
 * Helper function to wrap route handlers with automatic encryption
 * 
 * This is a convenience function that extracts auth from handler arguments
 * and automatically encrypts responses.
 * 
 * @param handler - Handler function that returns Response
 * @param request - HTTP request
 * @param env - Worker environment
 * @param auth - Authentication result
 * @returns Route result with encrypted response (if applicable)
 * 
 * @example
 * ```typescript
 * async function handleCustomerRoute(
 *   handler: (req: Request, env: Env, auth: AuthResult) => Promise<Response>,
 *   request: Request,
 *   env: Env,
 *   auth: AuthResult
 * ): Promise<RouteResult> {
 *   const handlerResponse = await handler(request, env, auth);
 *   return await wrapWithEncryption(handlerResponse, auth);
 * }
 * ```
 */
export async function wrapWithEncryption(
  handlerResponse: Response,
  auth: AuthResult | null | undefined
): Promise<RouteResult> {
  if (!auth?.jwtToken || !handlerResponse.ok) {
    return {
      response: handlerResponse,
      customerId: auth?.customerId || null,
    };
  }

  try {
    // Check if response is JSON
    const contentType = handlerResponse.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        response: handlerResponse,
        customerId: auth.customerId || null,
      };
    }

    // Parse and encrypt
    const responseData = await handlerResponse.json();
    const encrypted = await encryptWithJWT(responseData, auth.jwtToken);

    // Create encrypted response
    const headers = new Headers(handlerResponse.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Encrypted', 'true');

    return {
      response: new Response(JSON.stringify(encrypted), {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers: headers,
      }),
      customerId: auth.customerId || null,
    };
  } catch (error) {
    console.error('Failed to encrypt response:', error);
    return {
      response: handlerResponse,
      customerId: auth.customerId || null,
    };
  }
}

