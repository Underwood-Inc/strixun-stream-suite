/**
 * Standardized CORS with Localhost Support
 * 
 * Wrapper around API framework CORS that automatically allows localhost in development
 * This is the source of truth for CORS across all services
 */

import { createCORSHeaders as frameworkCreateCORSHeaders, handleCORSPreflight as frameworkHandleCORSPreflight, type CORSOptions } from './cors';

export interface CORSWithLocalhostOptions extends CORSOptions {
    /**
     * Environment object to check if we're in development
     */
    env?: {
        ENVIRONMENT?: string;
        [key: string]: any;
    };
    
    /**
     * Whether to automatically allow localhost in non-production environments
     * Default: true
     */
    allowLocalhostInDev?: boolean;
}

/**
 * Get effective allowed origins with localhost support
 * Automatically allows localhost in development mode
 */
function getEffectiveAllowedOrigins(
    request: Request,
    options: CORSWithLocalhostOptions
): string[] | ((origin: string) => boolean) {
    const origin = request.headers.get('Origin');
    const isProduction = options.env?.ENVIRONMENT === 'production';
    const allowLocalhostInDev = options.allowLocalhostInDev !== false; // Default to true
    
    // If localhost is detected and we're in dev mode, always allow it
    const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
    
    // If we have explicit allowedOrigins, use them
    if (options.allowedOrigins) {
        // If localhost in dev and not explicitly allowed, create a function that allows it
        if (isLocalhost && !isProduction && allowLocalhostInDev) {
            const explicitOrigins = Array.isArray(options.allowedOrigins) 
                ? options.allowedOrigins 
                : [];
            
            // Check if localhost is already explicitly allowed
            const localhostAllowed = explicitOrigins.some(allowed => {
                if (allowed === '*' || allowed === origin) return true;
                if (allowed.endsWith('*')) {
                    const prefix = allowed.slice(0, -1);
                    return origin && origin.startsWith(prefix);
                }
                return false;
            });
            
            // If not explicitly allowed, create a function that allows both explicit origins and localhost
            if (!localhostAllowed) {
                return (checkOrigin: string) => {
                    // Allow localhost in dev
                    if ((checkOrigin.includes('localhost') || checkOrigin.includes('127.0.0.1')) && !isProduction) {
                        return true;
                    }
                    // Check against explicit origins
                    if (typeof options.allowedOrigins === 'function') {
                        return options.allowedOrigins(checkOrigin);
                    }
                    if (Array.isArray(options.allowedOrigins)) {
                        return options.allowedOrigins.includes('*') || options.allowedOrigins.includes(checkOrigin);
                    }
                    return false;
                };
            }
        }
        
        // Return as-is if localhost is already handled or we're in production
        return options.allowedOrigins;
    }
    
    // No explicit origins configured
    if (isProduction) {
        // Production: deny cross-origin (return empty array - no origins allowed)
        return [];
    } else {
        // Development: allow all (including localhost)
        return ['*'];
    }
}

/**
 * Create CORS headers with automatic localhost support in development
 * This is the standardized CORS utility for all services
 */
export function createCORSHeaders(
    request: Request,
    options: CORSWithLocalhostOptions = {}
): Headers {
    const effectiveOrigins = getEffectiveAllowedOrigins(request, options);
    
    // Use framework's CORS with effective origins
    return frameworkCreateCORSHeaders(request, {
        ...options,
        allowedOrigins: effectiveOrigins,
    });
}

/**
 * Handle CORS preflight request with localhost support
 */
export function handleCORSPreflight(
    request: Request,
    options: CORSWithLocalhostOptions = {}
): Response | null {
    return frameworkHandleCORSPreflight(request, {
        ...options,
        allowedOrigins: getEffectiveAllowedOrigins(request, options),
    });
}

/**
 * Create CORS headers helper for Cloudflare Workers
 * Automatically extracts ENVIRONMENT from env and allows localhost in dev
 */
export function getCorsHeaders(
    env: { ENVIRONMENT?: string; ALLOWED_ORIGINS?: string; [key: string]: any },
    request: Request,
    customer?: { config?: { allowedOrigins?: string[] }; [key: string]: any } | null
): Headers {
    // Get allowed origins from customer config or env
    let allowedOrigins: string[] = [];
    
    if (customer?.config?.allowedOrigins && customer.config.allowedOrigins.length > 0) {
        allowedOrigins = customer.config.allowedOrigins;
    } else if (env.ALLOWED_ORIGINS) {
        allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    }
    
    // Create CORS headers with localhost support
    return createCORSHeaders(request, {
        env,
        allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : undefined,
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-OTP-API-Key',
            'X-Requested-With',
            'X-CSRF-Token',
            'X-Dashboard-Request',
        ],
        credentials: true,
    });
}
