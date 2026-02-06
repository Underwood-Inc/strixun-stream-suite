/**
 * CORS headers utility
 * 
 * Uses API framework as source of truth with localhost support
 * Re-exports standardized CORS from API framework
 */

// CRITICAL: Use the localhost-aware version that handles 'null' origins (file:// URLs)
// and localhost origins in development mode
import { getCorsHeadersWithLocalhost as frameworkGetCorsHeaders } from '@strixun/api-framework/enhanced';

interface Customer {
    config?: {
        allowedOrigins?: string[];
        [key: string]: any;
    };
    [key: string]: any;
}

interface Env {
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Get CORS headers for cross-origin requests
 * Uses API framework with automatic localhost support in development
 * 
 * @param env - Worker environment
 * @param request - HTTP request
 * @param customer - Customer object (optional, for customer-specific origins)
 * @returns CORS headers
 */
export function getCorsHeaders(env: Env, request: Request, customer: Customer | null = null): Headers {
    // Use API framework's standardized CORS with localhost support
    const headers = frameworkGetCorsHeaders(env, request, customer);
    
    // Build CSP connect-src dynamically from env vars (no hardcoded domains)
    const customerApiUrl = env.CUSTOMER_API_URL || (env.ENVIRONMENT === 'production' ? 'https://customer-api.idling.app' : 'http://localhost:8790');
    const authServiceUrl = env.AUTH_SERVICE_URL || env.JWT_ISSUER || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
    
    // Extract hostname from URLs for CSP (only allow same origin + configured services)
    const customerApiHost = customerApiUrl.startsWith('http') ? new URL(customerApiUrl).origin : customerApiUrl;
    const authServiceHost = authServiceUrl.startsWith('http') ? new URL(authServiceUrl).origin : authServiceUrl;
    
    // Add additional security headers (beyond CORS)
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' ${customerApiHost} ${authServiceHost}; img-src 'self' data: https:; font-src 'self' data:`);
    
    return headers;
}

/**
 * Convert Headers to Record<string, string> for spread syntax
 * CRITICAL: Headers objects cannot be spread directly - they must be converted first
 */
export function getCorsHeadersRecord(env: Env, request: Request, customer: Customer | null = null): Record<string, string> {
    const headers = getCorsHeaders(env, request, customer);
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
        record[key] = value;
    });
    return record;
}
