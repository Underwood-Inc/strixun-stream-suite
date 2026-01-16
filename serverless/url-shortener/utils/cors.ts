/**
 * CORS Utilities for URL Shortener
 * 
 * Re-exports standardized CORS from API framework.
 * Uses env.ALLOWED_ORIGINS for production, no fallbacks.
 */

import { getCorsHeaders as frameworkGetCorsHeaders } from '@strixun/api-framework/enhanced';

interface Env {
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Get CORS headers for cross-origin requests
 * Uses API framework with ALLOWED_ORIGINS from env
 * 
 * @param env - Worker environment (must have ALLOWED_ORIGINS in production)
 * @param request - HTTP request
 * @returns CORS headers as Record for spread syntax
 */
export function getCorsHeaders(env: Env, request: Request): Record<string, string> {
    const headers = frameworkGetCorsHeaders(env, request, null);
    
    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Build CSP connect-src dynamically from env vars (no hardcoded domains)
    const customerApiUrl = env.CUSTOMER_API_URL || (env.ENVIRONMENT === 'production' ? 'https://customer-api.idling.app' : 'http://localhost:8790');
    const authServiceUrl = env.AUTH_SERVICE_URL || env.JWT_ISSUER || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
    
    // Extract hostname from URLs for CSP (only allow same origin + configured services)
    const customerApiHost = customerApiUrl.startsWith('http') ? new URL(customerApiUrl).origin : customerApiUrl;
    const authServiceHost = authServiceUrl.startsWith('http') ? new URL(authServiceUrl).origin : authServiceUrl;
    
    headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' ${customerApiHost} ${authServiceHost}; img-src 'self' data: https:; font-src 'self' data:`);
    
    // Convert to Record for spread syntax compatibility
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
        record[key] = value;
    });
    return record;
}
