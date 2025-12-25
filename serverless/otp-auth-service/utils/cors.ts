/**
 * CORS headers utility
 * Handles cross-origin requests with customer-specific origin allowlists
 */

interface Customer {
    config?: {
        allowedOrigins?: string[];
        [key: string]: any;
    };
    [key: string]: any;
}

interface Env {
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

interface CorsHeaders {
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Methods': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Credentials': string;
    'Access-Control-Max-Age': string;
    'X-Content-Type-Options': string;
    'X-Frame-Options': string;
    'X-XSS-Protection': string;
    'Strict-Transport-Security': string;
    'Content-Security-Policy': string;
}

/**
 * Get CORS headers for cross-origin requests
 * @param env - Worker environment
 * @param request - HTTP request
 * @param customer - Customer object (optional, for customer-specific origins)
 * @returns CORS headers object
 */
export function getCorsHeaders(env: Env, request: Request, customer: Customer | null = null): CorsHeaders {
    const origin = request.headers.get('Origin');
    
    // Get customer-specific allowed origins if customer is provided
    let allowedOrigins: string[] = [];
    
    if (customer?.config?.allowedOrigins && customer.config.allowedOrigins.length > 0) {
        allowedOrigins = customer.config.allowedOrigins;
    }
    
    // Fallback to environment variable if no customer-specific config
    if (allowedOrigins.length === 0) {
        allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
    }
    
    // Check for exact match or wildcard patterns
    let allowOrigin: string | null = null;
    
    if (allowedOrigins.length > 0) {
        const matchedOrigin = allowedOrigins.find(allowed => {
            if (allowed === '*') return true;
            if (allowed.endsWith('*')) {
                const prefix = allowed.slice(0, -1);
                return origin && origin.startsWith(prefix);
            }
            return origin === allowed;
        });
        allowOrigin = matchedOrigin === '*' ? '*' : (matchedOrigin || null);
    } else {
        // No origins configured
        const isProduction = env.ENVIRONMENT === 'production';
        if (isProduction) {
            // Production: deny cross-origin requests (return 'null' which means no CORS)
            // This allows same-origin requests and requests without Origin header to succeed
            // but blocks cross-origin requests (secure default)
            allowOrigin = null;
            // Log warning for visibility (but don't fail the request)
            if (origin) {
                console.warn(`CORS: No ALLOWED_ORIGINS configured in production. Cross-origin request from ${origin} will be blocked. Set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS`);
            }
        } else {
            // Development: allow all (but warn)
            console.warn('CORS: No ALLOWED_ORIGINS configured. Allowing all origins in development mode.');
            allowOrigin = '*';
        }
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

