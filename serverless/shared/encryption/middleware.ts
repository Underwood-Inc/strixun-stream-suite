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
 *   return await wrapWithEncryption(handlerResponse, auth, request, env);
 * }
 * ```
 */
export async function wrapWithEncryption(
  handlerResponse: Response,
  auth: AuthResult | null | undefined,
  request?: Request,
  env?: { NETWORK_INTEGRITY_KEYPHRASE?: string; [key: string]: any }
): Promise<RouteResult> {
    // Don't encrypt if response is not OK
    if (!handlerResponse.ok) {
        // Still add integrity header for service-to-service error responses
        if (request && env && (!auth?.jwtToken || auth.userId === 'service')) {
            try {
                const { wrapResponseWithIntegrity } = await import('../service-client/integrity-response.js');
                const responseWithIntegrity = await wrapResponseWithIntegrity(handlerResponse, request, auth ?? null, env);
                return {
                    response: responseWithIntegrity,
                    customerId: auth?.customerId || null,
                };
            } catch (error) {
                console.error('Failed to add integrity header to error response:', error);
            }
        }
        return {
            response: handlerResponse,
            customerId: auth?.customerId || null,
        };
    }

  // If no auth token, return unencrypted (but still set header to false for clarity)
  // This is likely a service-to-service call - add integrity header
  if (!auth?.jwtToken || auth.userId === 'service') {
    const headers = new Headers(handlerResponse.headers);
    headers.set('X-Encrypted', 'false');
    
    // Add integrity header for service-to-service calls
    if (request && env) {
        try {
            const { wrapResponseWithIntegrity } = await import('../service-client/integrity-response.js');
            const responseWithIntegrity = await wrapResponseWithIntegrity(handlerResponse, request, auth ?? null, env);
            return {
                response: responseWithIntegrity,
                customerId: auth?.customerId || null,
            };
        } catch (error) {
            console.error('Failed to add integrity header to service response:', error);
            // Fall through to return response without integrity header
        }
    }
    
    return {
      response: new Response(handlerResponse.body, {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers: headers,
      }),
      customerId: auth?.customerId || null,
    };
  }

  try {
    // Check if response is JSON
    const contentType = handlerResponse.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      // Not JSON, don't encrypt but set header
      const headers = new Headers(handlerResponse.headers);
      headers.set('X-Encrypted', 'false');
      return {
        response: new Response(handlerResponse.body, {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers: headers,
        }),
        customerId: auth.customerId || null,
      };
    }

    // Parse and encrypt
    const responseData = await handlerResponse.json();
    
    // CRITICAL: Exclude thumbnailUrl from encryption - it's a public URL that browsers need to fetch directly
    // Extract thumbnailUrls before encryption and store them separately
    let thumbnailUrlsMap: Record<string, string> | null = null;
    if (responseData && typeof responseData === 'object' && responseData !== null) {
      thumbnailUrlsMap = {};
      
      // Type guard: check if responseData has mods property
      const dataWithMods = responseData as { mods?: unknown[]; mod?: { thumbnailUrl?: string } };
      
      // Handle mod list responses (array of mods)
      if (Array.isArray(dataWithMods.mods)) {
        dataWithMods.mods.forEach((mod: any, index: number) => {
          if (mod && typeof mod === 'object' && mod !== null && 'thumbnailUrl' in mod && typeof mod.thumbnailUrl === 'string') {
            thumbnailUrlsMap![`mods.${index}`] = mod.thumbnailUrl;
            // Temporarily remove to exclude from encryption
            delete mod.thumbnailUrl;
          }
        });
      }
      
      // Handle single mod responses
      if (dataWithMods.mod && typeof dataWithMods.mod === 'object' && dataWithMods.mod !== null && 'thumbnailUrl' in dataWithMods.mod && typeof dataWithMods.mod.thumbnailUrl === 'string') {
        thumbnailUrlsMap['mod'] = dataWithMods.mod.thumbnailUrl;
        delete dataWithMods.mod.thumbnailUrl;
      }
    }
    
    const encrypted = await encryptWithJWT(responseData, auth.jwtToken);
    
    // Add thumbnailUrls at top level (outside encrypted data) so they remain accessible
    // The frontend will need to merge them back after decryption
    if (thumbnailUrlsMap && Object.keys(thumbnailUrlsMap).length > 0) {
      (encrypted as any).thumbnailUrls = thumbnailUrlsMap;
    }

    // Create encrypted response - ALWAYS set X-Encrypted header
    const headers = new Headers(handlerResponse.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Encrypted', 'true');

    const encryptedResponse = new Response(JSON.stringify(encrypted), {
      status: handlerResponse.status,
      statusText: handlerResponse.statusText,
      headers: headers,
    });

    // For JWT-encrypted responses, we don't add integrity header
    // (integrity is only for service-to-service calls)
    return {
      response: encryptedResponse,
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

