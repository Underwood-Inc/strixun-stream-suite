/**
 * Router Middleware for Automatic Encryption
 * 
 * Provides reusable middleware for automatically encrypting API responses
 * when JWT tokens are present in the request.
 */

import type { EncryptionWrapperOptions } from './types.js';
import { encryptWithJWT } from './jwt-encryption.js';
import { isServiceToServiceCall, wrapResponseWithIntegrity } from '@strixun/service-client/integrity-response';

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
  customerId: string;
  jwtToken?: string;
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
 * Options for wrapWithEncryption
 */
export interface WrapWithEncryptionOptions {
  /** Whether JWT encryption is required (default: true - MANDATORY) */
  requireJWT?: boolean;
  /** Whether to allow service-to-service calls without JWT (default: false) */
  allowServiceCallsWithoutJWT?: boolean;
}

/**
 * Helper function to wrap route handlers with automatic encryption
 * 
 * This is a convenience function that extracts auth from handler arguments
 * and automatically encrypts responses.
 * 
 * **SECURITY HARDENING**: By default, JWT encryption is MANDATORY. All responses
 * must be encrypted with JWT token. This is the base security requirement.
 * 
 * @param handler - Handler function that returns Response
 * @param request - HTTP request
 * @param env - Worker environment
 * @param auth - Authentication result
 * @param options - Encryption options (default: requireJWT=true)
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
  env?: { NETWORK_INTEGRITY_KEYPHRASE?: string; [key: string]: any },
  options?: WrapWithEncryptionOptions
): Promise<RouteResult> {
  // Default to requiring JWT (security hardening)
  const requireJWT = options?.requireJWT !== false; // Default: true
  const allowServiceCallsWithoutJWT = options?.allowServiceCallsWithoutJWT === true; // Default: false
    // Detect service-to-service calls
    // This distinguishes between browser requests (no auth) and service-to-service calls (API key/service key)
    let isServiceCall = false;
    if (request) {
        isServiceCall = isServiceToServiceCall(request, auth ?? null);
    }
    
    // Don't encrypt if response is not OK
    if (!handlerResponse.ok) {
        // Still add integrity header for service-to-service error responses
        if (request && env && isServiceCall) {
            try {
                const responseWithIntegrity = await wrapResponseWithIntegrity(handlerResponse, request, auth ?? null, env);
                return {
                    response: responseWithIntegrity,
                    customerId: auth?.customerId || null,
                };
            } catch (error) {
                console.error('[NetworkIntegrity] Failed to add integrity header to error response:', error);
                // If integrity header addition fails, we MUST fail the request for security
                throw new Error(`[NetworkIntegrity] Failed to add integrity header to error response: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // If service call but no request/env, fail for security
        if (isServiceCall) {
            throw new Error('[NetworkIntegrity] Service-to-service error responses require request and env to add integrity headers');
        }
        // Browser request without auth - return error response as-is (no integrity header needed)
        return {
            response: handlerResponse,
            customerId: auth?.customerId || null,
        };
    }

  // If this is a service-to-service call, add integrity header (CRITICAL for security)
  // Browser requests without auth don't need integrity headers - they're not service-to-service calls
  if (isServiceCall) {
    // Add integrity header for service-to-service calls (CRITICAL for security)
    if (request && env) {
        try {
            const responseWithIntegrity = await wrapResponseWithIntegrity(handlerResponse, request, auth ?? null, env);
            
            // Check if integrity header was added
            const integrityHeader = responseWithIntegrity.headers.get('X-Strixun-Response-Integrity');
            if (!integrityHeader) {
                throw new Error('[NetworkIntegrity] Integrity header was not added to response');
            }
            // Ensure X-Encrypted header is set (wrapResponseWithIntegrity already added integrity header)
            // Read the body once (addResponseIntegrityHeader already converted it to string)
            const bodyText = await responseWithIntegrity.text();
            const finalHeaders = new Headers(responseWithIntegrity.headers);
            finalHeaders.set('X-Encrypted', 'false');
            
            // Create new response with integrity header preserved and X-Encrypted added
            const finalResponse = new Response(bodyText, {
                status: responseWithIntegrity.status,
                statusText: responseWithIntegrity.statusText,
                headers: finalHeaders,
            });
            
            return {
                response: finalResponse,
                customerId: auth?.customerId || null,
            };
        } catch (error) {
            console.error('[NetworkIntegrity] Failed to add integrity header to service response:', error);
            console.error('[NetworkIntegrity] Error stack:', error instanceof Error ? error.stack : 'No stack');
            // If integrity header addition fails, we MUST fail the request for security
            throw new Error(`[NetworkIntegrity] Failed to add integrity header: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // If no request/env provided, we CANNOT proceed without integrity headers for service calls
    // This is a security violation
    console.error('[NetworkIntegrity] Service-to-service call detected but request/env not provided for integrity header', {
      hasRequest: !!request,
      hasEnv: !!env,
      userId: auth?.customerId
    });
    throw new Error('[NetworkIntegrity] Service-to-service calls require request and env to add integrity headers');
  }

  // CRITICAL SECURITY: JWT encryption is MANDATORY by default
  // If no JWT token and JWT is required, return 401 Unauthorized
  if (!auth?.jwtToken) {
    // If requireJWT is explicitly false, allow unencrypted responses (for auth endpoints)
    if (!requireJWT) {
      // JWT not required - return unencrypted response
      const contentType = handlerResponse.headers.get('content-type');
      const headers = new Headers(handlerResponse.headers);
      headers.set('X-Encrypted', 'false');
      
      if (contentType?.includes('application/json')) {
        const bodyText = await handlerResponse.text();
        return {
          response: new Response(bodyText, {
            status: handlerResponse.status,
            statusText: handlerResponse.statusText,
            headers: headers,
          }),
          customerId: auth?.customerId || null,
        };
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
    
    // Check if this is a service-to-service call that's allowed without JWT
    if (isServiceCall && allowServiceCallsWithoutJWT) {
      // Service call allowed without JWT - return unencrypted with integrity header
      const contentType = handlerResponse.headers.get('content-type');
      const headers = new Headers(handlerResponse.headers);
      headers.set('X-Encrypted', 'false');
      
      if (contentType?.includes('application/json')) {
        const bodyText = await handlerResponse.text();
        return {
          response: new Response(bodyText, {
            status: handlerResponse.status,
            statusText: handlerResponse.statusText,
            headers: headers,
          }),
          customerId: auth?.customerId || null,
        };
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
    
    // JWT is required but not present - return 401 Unauthorized
    if (requireJWT) {
      const errorResponse = {
        type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
        title: 'Unauthorized',
        status: 401,
        detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
        instance: request?.url || '/'
      };
      
      const corsHeaders = request ? await import('@strixun/api-framework/enhanced').then(m => 
        m.createCORSHeaders(request, { allowedOrigins: ['*'] })
      ) : new Headers();
      
      return {
        response: new Response(JSON.stringify(errorResponse), {
          status: 401,
          statusText: 'Unauthorized',
          headers: {
            'Content-Type': 'application/problem+json',
            ...Object.fromEntries(corsHeaders.entries()),
            'X-Encrypted': 'false',
          },
        }),
        customerId: null,
      };
    }
    
    // JWT not required - return unencrypted (for endpoints that explicitly don't require JWT, like auth endpoints that return JWTs)
    const headers = new Headers(handlerResponse.headers);
    headers.set('X-Encrypted', 'false');
    
    // Get content type before reading body
    const contentType = handlerResponse.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const bodyText = await handlerResponse.text();
      return {
        response: new Response(bodyText, {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers: headers,
        }),
        customerId: auth?.customerId || null,
      };
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

  // Declare variables outside try block for use in catch block
  let responseData: unknown = null;
  let thumbnailUrlsMap: Record<string, string> | null = null;
  
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

    // Parse and encrypt (we know auth.jwtToken exists from check above)
    responseData = await handlerResponse.json();
    
    // DEBUG: Log token used for encryption (especially for /auth/me)
    const isAuthMe = request?.url?.includes('/auth/me');
    if (isAuthMe) {
        console.log('[wrapWithEncryption] Preparing to encrypt /auth/me response:', {
            jwtTokenLength: auth.jwtToken?.length || 0,
            jwtTokenPrefix: auth.jwtToken ? auth.jwtToken.substring(0, 20) + '...' : 'none',
            jwtTokenSuffix: auth.jwtToken ? '...' + auth.jwtToken.substring(auth.jwtToken.length - 10) : 'none',
            responseDataType: typeof responseData,
            responseDataKeys: responseData && typeof responseData === 'object' ? Object.keys(responseData) : null,
        });
    }
    
    // CRITICAL: Exclude thumbnailUrl from encryption - it's a public URL that browsers need to fetch directly
    // Extract thumbnailUrls before encryption and store them separately
    thumbnailUrlsMap = null;
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
    
    if (isAuthMe) {
        console.log('[wrapWithEncryption] /auth/me response encrypted:', {
            encryptedKeys: encrypted && typeof encrypted === 'object' ? Object.keys(encrypted) : null,
            hasTokenHash: encrypted && typeof encrypted === 'object' && 'tokenHash' in encrypted ? !!encrypted.tokenHash : false,
            tokenHash: encrypted && typeof encrypted === 'object' && 'tokenHash' in encrypted ? (encrypted as any).tokenHash : null,
            tokenHashLength: encrypted && typeof encrypted === 'object' && 'tokenHash' in encrypted ? String((encrypted as any).tokenHash).length : 0,
        });
    }
    
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
    
    // If JSON parsing failed, responseData will be null and body is already consumed
    // In this case, we can't reconstruct the response - return error response
    if (responseData === null) {
      const headers = new Headers(handlerResponse.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Encrypted', 'false');
      return {
        response: new Response(JSON.stringify({
          error: 'Failed to parse response for encryption',
          message: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          statusText: 'Internal Server Error',
          headers: headers,
        }),
        customerId: auth.customerId || null,
      };
    }
    
    // Encryption failed but we have parsed data - return unencrypted with X-Encrypted: false
    const headers = new Headers(handlerResponse.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Encrypted', 'false');
    
    // Restore thumbnailUrls if they were removed before encryption attempt
    let dataToReturn = responseData;
    if (thumbnailUrlsMap && Object.keys(thumbnailUrlsMap).length > 0 && dataToReturn && typeof dataToReturn === 'object') {
      const dataWithMods = dataToReturn as any;
      // Restore thumbnailUrls that were removed
      if (Array.isArray(dataWithMods.mods)) {
        dataWithMods.mods.forEach((mod: any, index: number) => {
          const key = `mods.${index}`;
          if (thumbnailUrlsMap![key]) {
            mod.thumbnailUrl = thumbnailUrlsMap![key];
          }
        });
      }
      if (dataWithMods.mod && thumbnailUrlsMap['mod']) {
        dataWithMods.mod.thumbnailUrl = thumbnailUrlsMap['mod'];
      }
    }
    
    return {
      response: new Response(JSON.stringify(dataToReturn), {
        status: handlerResponse.status,
        statusText: handlerResponse.statusText,
        headers: headers,
      }),
      customerId: auth.customerId || null,
    };
  }
}

