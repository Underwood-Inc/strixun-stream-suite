/**
 * Cache headers utility for OTP endpoints
 * Ensures OTP-related requests/responses are never cached by Cloudflare or browsers
 */

/**
 * Get cache prevention headers for OTP endpoints
 * These headers ensure:
 * - Cloudflare doesn't cache the response
 * - Browsers don't cache the response
 * - Service workers don't cache the response
 * - CDNs don't cache the response
 * 
 * @returns Headers object with cache prevention directives
 */
export function getOtpCacheHeaders(): Record<string, string> {
    return {
        // Standard HTTP cache prevention headers
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        
        // Cloudflare-specific cache bypass
        // Note: CF-Cache-Status is set by Cloudflare automatically based on Cache-Control
        // The 'no-store' directive tells Cloudflare to never cache this response
        
        // Additional headers to prevent any caching
        'X-Accel-Buffering': 'no', // Nginx/Cloudflare: disable buffering
        'Surrogate-Control': 'no-store', // CDN cache prevention
    };
}

/**
 * Get cache prevention headers for authentication endpoints
 * Similar to OTP headers but specifically for auth endpoints
 */
export function getAuthCacheHeaders(): Record<string, string> {
    return getOtpCacheHeaders();
}

