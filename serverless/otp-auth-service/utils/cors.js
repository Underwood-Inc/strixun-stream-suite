/**
 * CORS headers utility
 * Handles cross-origin requests with customer-specific origin allowlists
 */

/**
 * Get CORS headers for cross-origin requests
 * @param {*} env - Worker environment
 * @param {Request} request - HTTP request
 * @param {object|null} customer - Customer object (optional, for customer-specific origins)
 * @returns {object} CORS headers object
 */
export function getCorsHeaders(env, request, customer = null) {
    const origin = request.headers.get('Origin');
    
    // Get customer-specific allowed origins if customer is provided
    let allowedOrigins = [];
    
    if (customer && customer.config && customer.config.allowedOrigins && customer.config.allowedOrigins.length > 0) {
        allowedOrigins = customer.config.allowedOrigins;
    }
    
    // Fallback to environment variable if no customer-specific config
    if (allowedOrigins.length === 0) {
        allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
    }
    
    // If no origins configured, allow all (for development only)
    // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
    let allowOrigin = '*'; // Default fallback
    
    if (allowedOrigins.length > 0) {
        // Check for exact match or wildcard patterns
        const matchedOrigin = allowedOrigins.find(allowed => {
            if (allowed === '*') return true;
            if (allowed.endsWith('*')) {
                const prefix = allowed.slice(0, -1);
                return origin && origin.startsWith(prefix);
            }
            return origin === allowed;
        });
        allowOrigin = matchedOrigin === '*' ? '*' : (matchedOrigin || null);
    }
    
    return {
        'Access-Control-Allow-Origin': allowOrigin || 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OTP-API-Key, X-Requested-With, X-CSRF-Token, X-Dashboard-Request',
        'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
        'Access-Control-Max-Age': '86400',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'",
    };
}

