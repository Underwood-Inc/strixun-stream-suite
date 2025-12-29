/**
 * Response Integrity Helper
 * 
 * Utility functions to add integrity headers to service-to-service API responses.
 * This ensures that all responses from services include the X-Strixun-Response-Integrity
 * header that ServiceClient expects for verification.
 */

import { calculateResponseIntegrity } from './integrity.js';

/**
 * Check if a request is a service-to-service call (API key auth, not JWT)
 * @param request - HTTP request
 * @param auth - Authentication result from the service
 * @returns true if this is a service-to-service call
 */
export function isServiceToServiceCall(
    request: Request,
    auth: { userId?: string; jwtToken?: string; customerId?: string | null } | null
): boolean {
    console.log('[isServiceToServiceCall] Checking if service call', {
      url: request.url,
      method: request.method,
      hasAuth: !!auth,
      userId: auth?.userId,
      hasJwtToken: !!auth?.jwtToken,
      jwtTokenLength: auth?.jwtToken?.length || 0
    });
    
    // Check for service key header (X-Service-Key)
    const serviceKey = request.headers.get('X-Service-Key');
    if (serviceKey) {
        console.log('[isServiceToServiceCall] Detected service call via X-Service-Key header');
        return true;
    }
    
    // Check for SUPER_ADMIN_API_KEY in Authorization header (Bearer token that's not a JWT)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // SUPER_ADMIN_API_KEY is typically a long random string, not a JWT
        // JWT tokens have 3 parts separated by dots (header.payload.signature)
        // If it doesn't have dots or has more than 3 parts, it's likely an API key
        const parts = token.split('.');
        if (parts.length !== 3) {
            // Not a JWT format - likely an API key
            console.log('[isServiceToServiceCall] Detected service call via non-JWT Bearer token');
            return true;
        }
    }
    
    // If auth is null but we got here, check if it's a non-Bearer auth
    if (!auth) {
        if (authHeader && !authHeader.startsWith('Bearer ')) {
            console.log('[isServiceToServiceCall] Detected service call via non-Bearer auth');
            return true;
        }
        console.log('[isServiceToServiceCall] Not a service call - no auth and no service indicators');
        return false;
    }
    
    // If userId is 'service', it's a service-to-service call
    if (auth.userId === 'service') {
        console.log('[isServiceToServiceCall] Detected service call via userId="service"');
        return true;
    }
    
    // If there's no JWT token but auth exists, it's likely API key auth
    if (!auth.jwtToken || auth.jwtToken === '') {
        console.log('[isServiceToServiceCall] Detected service call via missing JWT token');
        return true;
    }
    
    console.log('[isServiceToServiceCall] Not a service call - has JWT token');
    return false;
}

/**
 * Add integrity header to a response for service-to-service calls
 * @param response - HTTP response
 * @param keyphrase - Network integrity keyphrase from environment
 * @returns New response with integrity header added
 */
export async function addResponseIntegrityHeader(
    response: Response,
    keyphrase: string
): Promise<Response> {
    console.log('[addResponseIntegrityHeader] Starting', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      hasKeyphrase: !!keyphrase,
      keyphraseLength: keyphrase?.length || 0
    });
    
    // Clone response to read body (CRITICAL: must clone before reading)
    const responseClone = response.clone();
    
    // Get response body text
    let bodyText: string;
    const contentType = response.headers.get('content-type');
    
    try {
        if (contentType?.includes('application/json')) {
            try {
                const data = await responseClone.json();
                bodyText = JSON.stringify(data);
                console.log('[addResponseIntegrityHeader] Read JSON body', {
                  bodyLength: bodyText.length,
                  bodyPreview: bodyText.substring(0, 100)
                });
            } catch (error) {
                // If JSON parsing fails, try text
                bodyText = await responseClone.text();
                console.log('[addResponseIntegrityHeader] JSON parse failed, read as text', {
                  bodyLength: bodyText.length
                });
            }
        } else {
            bodyText = await responseClone.text();
            console.log('[addResponseIntegrityHeader] Read text body', {
              bodyLength: bodyText.length
            });
        }
    } catch (error) {
        // If body reading fails, use empty string (shouldn't happen but be safe)
        console.error('[NetworkIntegrity] Failed to read response body for integrity header:', error);
        bodyText = '';
    }
    
    // Calculate integrity signature
    console.log('[addResponseIntegrityHeader] Calculating integrity signature', {
      status: response.status,
      bodyLength: bodyText.length
    });
    
    const integrityHeader = await calculateResponseIntegrity(
        response.status,
        bodyText,
        keyphrase
    );
    
    console.log('[addResponseIntegrityHeader] Integrity signature calculated', {
      headerLength: integrityHeader.length,
      headerPreview: integrityHeader.substring(0, 50)
    });
    
    // Create new headers with integrity header
    const headers = new Headers(response.headers);
    headers.set('X-Strixun-Response-Integrity', integrityHeader);
    
    // Verify header was set
    const verifyHeader = headers.get('X-Strixun-Response-Integrity');
    console.log('[addResponseIntegrityHeader] Header set in Headers object', {
      hasHeader: !!verifyHeader,
      headerLength: verifyHeader?.length || 0,
      allHeaders: Array.from(headers.entries()).map(([k, v]) => [k, k === 'X-Strixun-Response-Integrity' ? v.substring(0, 50) + '...' : v])
    });
    
    // Return new response with integrity header
    const newResponse = new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
    });
    
    // Final verification
    const finalHeader = newResponse.headers.get('X-Strixun-Response-Integrity');
    console.log('[addResponseIntegrityHeader] Final response created', {
      hasIntegrityHeader: !!finalHeader,
      headerLength: finalHeader?.length || 0,
      status: newResponse.status,
      allHeaders: Array.from(newResponse.headers.entries()).map(([k]) => k)
    });
    
    return newResponse;
}

/**
 * Get network integrity keyphrase from environment
 * @param env - Worker environment
 * @returns Keyphrase or dev fallback
 */
export function getNetworkIntegrityKeyphrase(env: { NETWORK_INTEGRITY_KEYPHRASE?: string }): string {
    if (env.NETWORK_INTEGRITY_KEYPHRASE) {
        return env.NETWORK_INTEGRITY_KEYPHRASE;
    }
    
    // Fallback for development (should not be used in production)
    console.warn('[NetworkIntegrity] Using dev fallback for NETWORK_INTEGRITY_KEYPHRASE - set NETWORK_INTEGRITY_KEYPHRASE in production!');
    return 'strixun:network-integrity:dev-fallback';
}

/**
 * Wrap a response with integrity header if it's a service-to-service call
 * @param response - HTTP response
 * @param request - HTTP request
 * @param auth - Authentication result
 * @param env - Worker environment
 * @returns Response with integrity header if service-to-service, otherwise original response
 */
export async function wrapResponseWithIntegrity(
    response: Response,
    request: Request,
    auth: { userId?: string; jwtToken?: string } | null,
    env: { NETWORK_INTEGRITY_KEYPHRASE?: string }
): Promise<Response> {
    console.log('[wrapResponseWithIntegrity] Called', {
      url: request.url,
      method: request.method,
      responseStatus: response.status,
      hasAuth: !!auth,
      userId: auth?.userId,
      hasJwtToken: !!auth?.jwtToken,
      hasEnv: !!env,
      hasKeyphrase: !!env.NETWORK_INTEGRITY_KEYPHRASE
    });
    
    // Check if this is an image response (should always have integrity headers)
    const contentType = response.headers.get('content-type') || '';
    const isImageResponse = contentType.startsWith('image/') || 
                           contentType === 'image/svg+xml' ||
                           request.url.includes('/badge') ||
                           request.url.includes('/thumbnail') ||
                           request.url.includes('/og-image');
    
    // Only add integrity header for service-to-service calls OR image responses
    const isServiceCall = isServiceToServiceCall(request, auth);
    if (!isServiceCall && !isImageResponse) {
        console.log('[wrapResponseWithIntegrity] Not a service-to-service call and not an image, skipping integrity header', {
            hasAuth: !!auth,
            userId: auth?.userId,
            hasJwtToken: !!auth?.jwtToken,
            serviceKey: request.headers.get('X-Service-Key') ? 'present' : 'missing',
            contentType
        });
        return response;
    }
    
    if (isImageResponse && !isServiceCall) {
        console.log('[wrapResponseWithIntegrity] Image response detected, adding integrity header', {
            contentType,
            url: request.url
        });
    }
    
    console.log('[wrapResponseWithIntegrity] Service call confirmed, proceeding with integrity header');
    
    // Get keyphrase
    const keyphrase = getNetworkIntegrityKeyphrase(env);
    if (!keyphrase) {
        console.error('[wrapResponseWithIntegrity] NETWORK_INTEGRITY_KEYPHRASE is missing');
        throw new Error('[NetworkIntegrity] NETWORK_INTEGRITY_KEYPHRASE is required but not set');
    }
    
    console.log('[wrapResponseWithIntegrity] Keyphrase obtained', {
      hasKeyphrase: !!keyphrase,
      keyphraseLength: keyphrase.length,
      isDevFallback: keyphrase === 'strixun:network-integrity:dev-fallback'
    });
    
    // Add integrity header (CRITICAL: must always succeed for service calls)
    try {
        console.log('[wrapResponseWithIntegrity] Calling addResponseIntegrityHeader');
        const responseWithIntegrity = await addResponseIntegrityHeader(response, keyphrase);
        
        // Verify header was added
        const integrityHeader = responseWithIntegrity.headers.get('X-Strixun-Response-Integrity');
        console.log('[wrapResponseWithIntegrity] Response from addResponseIntegrityHeader', {
          hasIntegrityHeader: !!integrityHeader,
          headerLength: integrityHeader?.length || 0,
          status: responseWithIntegrity.status,
          allHeaders: Array.from(responseWithIntegrity.headers.entries()).map(([k]) => k)
        });
        
        if (!integrityHeader) {
            console.error('[wrapResponseWithIntegrity] CRITICAL: Integrity header missing after addition');
            throw new Error('[NetworkIntegrity] Failed to add integrity header - header missing after addition');
        }
        
        console.log('[wrapResponseWithIntegrity] Successfully added integrity header');
        return responseWithIntegrity;
    } catch (error) {
        console.error('[NetworkIntegrity] CRITICAL: Failed to add integrity header to service response:', error);
        console.error('[NetworkIntegrity] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        throw new Error(`[NetworkIntegrity] Failed to add integrity header: ${error instanceof Error ? error.message : String(error)}`);
    }
}

