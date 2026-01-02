/**
 * CORS utilities for mods-api
 * 
 * Uses API framework as source of truth with localhost support
 * Re-exports standardized CORS from API framework
 */

import { getCorsHeaders as frameworkGetCorsHeaders } from '@strixun/api-framework/enhanced';

interface Env {
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Create CORS headers with localhost detection
 * This wrapper ensures localhost is always allowed for development
 * Uses API framework as source of truth
 */
export function createCORSHeadersWithLocalhost(
    request: Request,
    env: Env
): Headers {
    // Use API framework's standardized CORS with localhost support
    return frameworkGetCorsHeaders(env, request, null);
}
