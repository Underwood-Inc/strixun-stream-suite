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
 * 
 * CRITICAL: When credentials mode is used (which is default for our services),
 * we MUST echo back the exact origin, not use '*'. This function ensures that.
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
    
    // CRITICAL: Handle 'null' origin from file:// URLs in development
    // When developers open HTML test files directly from filesystem, Origin is 'null'
    const isNullOrigin = origin === 'null';
    
    // If we have explicit allowedOrigins with actual values, use them
    if (options.allowedOrigins && 
        (typeof options.allowedOrigins === 'function' || 
         (Array.isArray(options.allowedOrigins) && options.allowedOrigins.length > 0))) {
        // In development, create a function that allows localhost and 'null' origins (for file:// URLs)
        const needsDevOverride = !isProduction && allowLocalhostInDev && (isLocalhost || isNullOrigin);
        
        if (needsDevOverride) {
            const explicitOrigins = Array.isArray(options.allowedOrigins) 
                ? options.allowedOrigins 
                : [];
            
            // Check if origin is already explicitly allowed
            const alreadyAllowed = explicitOrigins.some(allowed => {
                if (allowed === '*' || allowed === origin) return true;
                if (allowed.endsWith('*') && origin) {
                    const prefix = allowed.slice(0, -1);
                    return origin.startsWith(prefix);
                }
                return false;
            });
            
            // If not explicitly allowed, create a function that allows dev origins
            if (!alreadyAllowed) {
                return (checkOrigin: string) => {
                    // Allow 'null' origin in dev (file:// URLs)
                    if (checkOrigin === 'null' && !isProduction) {
                        return true;
                    }
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
        
        // Return as-is if already handled or we're in production
        return options.allowedOrigins;
    }
    
    // No explicit origins configured
    if (isProduction) {
        // Production WITHOUT ALLOWED_ORIGINS = configuration error
        // Log error and return empty array - CORS will fail as it should
        console.error('[CORS] CRITICAL: No ALLOWED_ORIGINS configured in production! CORS will fail. Set the ALLOWED_ORIGINS environment variable.');
        return [];
    }
    
    // Development only: allow all origins for local testing
    return ['*'];
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
 * 
 * MULTI-TENANCY: When customer has allowedOrigins configured, use THOSE instead of env.ALLOWED_ORIGINS
 * This allows each tenant to configure their own domains for API key usage
 */
export function getCorsHeaders(
    env: { ENVIRONMENT?: string; ALLOWED_ORIGINS?: string; [key: string]: any },
    request: Request,
    customer?: { config?: { allowedOrigins?: string[] }; [key: string]: any } | null
): Headers {
    const requestOrigin = request.headers.get('Origin');
    
    // MULTI-TENANCY: Customer's allowedOrigins takes precedence
    // This enables third-party developers to use API keys from their own domains
    let allowedOrigins: string[] = [];
    let usingCustomerOrigins = false;
    
    // Check if customer has configured their own allowed origins
    if (customer?.config?.allowedOrigins && customer.config.allowedOrigins.length > 0) {
        // Use CUSTOMER's configured origins (multi-tenant mode)
        allowedOrigins = customer.config.allowedOrigins;
        usingCustomerOrigins = true;
    } else {
        // Fallback to platform origins
        if (env.ALLOWED_ORIGINS) {
            allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0);
        }
    }
    
    // Debug logging for CORS issues
    if (env.ENVIRONMENT === 'production' && allowedOrigins.length === 0 && !usingCustomerOrigins) {
        console.error('[CORS] CRITICAL: No origins configured!', {
            environment: env.ENVIRONMENT,
            hasEnvAllowedOrigins: !!env.ALLOWED_ORIGINS,
            hasCustomerOrigins: !!customer?.config?.allowedOrigins,
            requestOrigin,
        });
    }
    
    // Check if origin is in allowed list
    const originAllowed = allowedOrigins.length === 0 || 
        allowedOrigins.includes('*') || 
        (requestOrigin && allowedOrigins.includes(requestOrigin));
    
    if (!originAllowed && requestOrigin) {
        console.warn('[CORS] Origin not in allowed list:', {
            requestOrigin,
            allowedOriginsCount: allowedOrigins.length,
            usingCustomerOrigins,
            firstFewAllowed: allowedOrigins.slice(0, 3),
        });
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
