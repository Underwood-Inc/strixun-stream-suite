/**
 * CORS headers utility
 * 
 * Uses API framework as source of truth with localhost support
 * Re-exports standardized CORS from API framework
 */

import { getCorsHeaders as frameworkGetCorsHeaders } from '@strixun/api-framework/enhanced';

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
    
    // Add additional security headers (beyond CORS)
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://customer-api.idling.app https://auth.idling.app; img-src 'self' data: https:; font-src 'self' data:");
    
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
