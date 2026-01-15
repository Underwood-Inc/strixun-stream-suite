/**
 * CORS Utilities for Chat Signaling
 * 
 * Re-exports standardized CORS from API framework.
 * Uses env.ALLOWED_ORIGINS for production, no fallbacks.
 */

import { getCorsHeaders as frameworkGetCorsHeaders } from '@strixun/api-framework/enhanced';
import type { Env, CorsHeaders } from '../types';

/**
 * Get CORS headers for cross-origin requests
 * Uses API framework with ALLOWED_ORIGINS from env
 * 
 * @param env - Worker environment (must have ALLOWED_ORIGINS in production)
 * @param request - HTTP request
 * @returns CORS headers as CorsHeaders type
 */
export function getCorsHeaders(env: Env, request: Request): CorsHeaders {
    const headers = frameworkGetCorsHeaders(env, request, null);
    
    // Add security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    
    // Convert to CorsHeaders type for compatibility
    const record: CorsHeaders = {
        'Access-Control-Allow-Origin': headers.get('Access-Control-Allow-Origin') || 'null',
        'Access-Control-Allow-Methods': headers.get('Access-Control-Allow-Methods') || 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': headers.get('Access-Control-Allow-Headers') || 'Content-Type, Authorization, X-Device-ID, X-Requested-With, X-CSRF-Token',
        'Access-Control-Allow-Credentials': headers.get('Access-Control-Allow-Credentials') || 'true',
        'Access-Control-Max-Age': headers.get('Access-Control-Max-Age') || '86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    };
    return record;
}
