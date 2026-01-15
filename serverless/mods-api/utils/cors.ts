/**
 * CORS Utilities for Mods API
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
 * @returns CORS headers
 */
export function getCorsHeaders(env: Env, request: Request): Headers {
    const headers = frameworkGetCorsHeaders(env, request, null);
    
    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    return headers;
}

/**
 * Convert Headers to Record<string, string> for spread syntax
 */
export function getCorsHeadersRecord(env: Env, request: Request): Record<string, string> {
    const headers = getCorsHeaders(env, request);
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
        record[key] = value;
    });
    return record;
}
