/**
 * Response Integrity Helper
 * 
 * Utility functions to add integrity headers to service-to-service API responses.
 * This ensures that all responses from services include the X-Strixun-Response-Integrity
 * header that ServiceClient expects for verification.
 */

import { calculateResponseIntegrity } from './integrity';

/**
 * Check if a request is a service-to-service call (API key auth, not JWT)
 * @param request - HTTP request
 * @param auth - Authentication result from the service
 * @returns true if this is a service-to-service call
 */
export function isServiceToServiceCall(
    request: Request,
    auth: { customerId: string; jwtToken?: string } | null
): boolean {
    // CRITICAL: Check for X-Strixun-Request-Integrity header first
    // This is the most reliable indicator of a service-to-service call from service-client
    const requestIntegrityHeader = request.headers.get('X-Strixun-Request-Integrity');
    if (requestIntegrityHeader) {
        return true;
    }
    
    // Check for X-Service-Request header (simple marker for service-to-service calls)
    // This allows services to use JWT tokens for auth while still being recognized as service calls
    const serviceRequestHeader = request.headers.get('X-Service-Request');
    if (serviceRequestHeader === 'true') {
        return true;
    }
    
    // Check for X-Service-Key header (used by some services for internal auth)
    const serviceKeyHeader = request.headers.get('X-Service-Key');
    if (serviceKeyHeader) {
        return true;
    }
    
    // Check for SUPER_ADMIN_API_KEY in Authorization header (Bearer token that's not a JWT)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
        // SUPER_ADMIN_API_KEY is typically a long random string, not a JWT
        // JWT tokens have 3 parts separated by dots (header.payload.signature)
        // If it doesn't have dots or has more than 3 parts, it's likely an API key
        const parts = token.split('.');
        if (parts.length !== 3) {
            // Not a JWT format - likely an API key
            return true;
        }
    }
    
    // If auth is null but we got here, check if it's a non-Bearer auth
    if (!auth) {
        if (authHeader && !authHeader.startsWith('Bearer ')) {
            return true;
        }
        return false;
    }
    
    // If userId is 'service', it's a service-to-service call
    if (auth.customerId === 'service') {
        return true;
    }
    
    // If there's no JWT token but auth exists, it's likely API key auth
    if (!auth.jwtToken || auth.jwtToken === '') {
        return true;
    }
    
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
    // CRITICAL: Clone response to read body without consuming original
    const responseClone = response.clone();
    
    // Read body as ArrayBuffer to preserve exact bytes (no encoding/decoding issues)
    let bodyBytes: ArrayBuffer;
    try {
        bodyBytes = await responseClone.arrayBuffer();
    } catch (error) {
        // If body reading fails, use empty buffer (shouldn't happen but be safe)
        console.error('[NetworkIntegrity] Failed to read response body for integrity header:', error);
        bodyBytes = new ArrayBuffer(0);
    }
    
    // Calculate integrity signature using exact bytes
    const integrityHeader = await calculateResponseIntegrity(
        response.status,
        bodyBytes,
        keyphrase
    );
    
    // Create new headers with integrity header
    const headers = new Headers(response.headers);
    headers.set('X-Strixun-Response-Integrity', integrityHeader);
    
    // Return new response with integrity header
    // CRITICAL: Use original body bytes directly to avoid any encoding/decoding issues
    return new Response(bodyBytes, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
    });
}

/**
 * Get network integrity keyphrase from environment
 * @param env - Worker environment
 * @returns Keyphrase
 * @throws Error if NETWORK_INTEGRITY_KEYPHRASE is not set
 */
export function getNetworkIntegrityKeyphrase(env: { NETWORK_INTEGRITY_KEYPHRASE?: string }): string {
    if (!env.NETWORK_INTEGRITY_KEYPHRASE) {
        throw new Error('NETWORK_INTEGRITY_KEYPHRASE environment variable is required. Set it via: wrangler secret put NETWORK_INTEGRITY_KEYPHRASE');
    }
    return env.NETWORK_INTEGRITY_KEYPHRASE;
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
    auth: { customerId: string; jwtToken?: string } | null,
    env: { NETWORK_INTEGRITY_KEYPHRASE?: string }
): Promise<Response> {
    // Check if this is a service-to-service call
    const isServiceCall = isServiceToServiceCall(request, auth);
    
    // Check if this is an image response (should always have integrity headers)
    // CRITICAL: Only treat as image if status is 200 AND content type is actually an image
    // This prevents error responses (404, 500) from being treated as images
    const contentType = response.headers.get('content-type') || '';
    const isSuccessfulImage = response.status === 200 && (
        contentType.startsWith('image/') || 
        contentType === 'image/svg+xml'
    );
    const isImageUrl = request.url.includes('/badge') ||
                      request.url.includes('/thumbnail') ||
                      request.url.includes('/og-image');
    // Only treat as image response if it's successful AND has image content type
    // OR if it's an image URL pattern (for cases where content-type might not be set yet)
    const isImageResponse = isSuccessfulImage || (response.status === 200 && isImageUrl);
    
    // Only add integrity header for service-to-service calls OR image responses
    if (!isServiceCall && !isImageResponse) {
        return response;
    }
    
    if (isImageResponse && !isServiceCall) {
        // Image responses need integrity headers too
    }
    
    // Get keyphrase - throws if not set (no fallbacks!)
    const keyphrase = getNetworkIntegrityKeyphrase(env);
    
    // Add integrity header (CRITICAL: must always succeed for service calls)
    try {
        const responseWithIntegrity = await addResponseIntegrityHeader(response, keyphrase);
        
        // Verify header was added
        const integrityHeader = responseWithIntegrity.headers.get('X-Strixun-Response-Integrity');
        if (!integrityHeader) {
            throw new Error('[NetworkIntegrity] Failed to add integrity header - header missing after addition');
        }
        
        return responseWithIntegrity;
    } catch (error) {
        console.error('[NetworkIntegrity] CRITICAL: Failed to add integrity header to service response:', error);
        throw new Error(`[NetworkIntegrity] Failed to add integrity header: ${error instanceof Error ? error.message : String(error)}`);
    }
}

