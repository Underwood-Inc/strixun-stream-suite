/**
 * CORS utilities for mods-api
 * Provides localhost detection for development
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * Get effective allowed origins with localhost detection
 * Always allows localhost for development, even if not in ALLOWED_ORIGINS
 */
function getEffectiveAllowedOrigins(
    request: Request,
    env: { ALLOWED_ORIGINS?: string }
): string[] {
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    
    // Always allow localhost for development (even in production mode)
    // This ensures local development works without needing to configure ALLOWED_ORIGINS
    const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
    
    // If no origins configured, allow all (including localhost)
    // If localhost is detected, always allow it (for development)
    let effectiveOrigins = allowedOrigins.length > 0 ? allowedOrigins : ['*'];
    
    // Always allow localhost for development (even if not in allowedOrigins)
    if (isLocalhost) {
        // Check if localhost is already in allowedOrigins
        const localhostAllowed = allowedOrigins.some(o => {
            if (o === '*' || o === origin) return true;
            if (o.endsWith('*')) {
                const prefix = o.slice(0, -1);
                return origin && origin.startsWith(prefix);
            }
            return false;
        });
        
        // If localhost not explicitly allowed, add wildcard or the specific origin
        if (!localhostAllowed) {
            effectiveOrigins = ['*']; // Allow all for localhost development
        }
    }
    
    return effectiveOrigins;
}

/**
 * Create CORS headers with localhost detection
 * This wrapper ensures localhost is always allowed for development
 */
export function createCORSHeadersWithLocalhost(
    request: Request,
    env: { ALLOWED_ORIGINS?: string }
): Headers {
    const effectiveOrigins = getEffectiveAllowedOrigins(request, env);
    
    return createCORSHeaders(request, {
        allowedOrigins: effectiveOrigins,
    });
}
