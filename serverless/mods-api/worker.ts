/**
 * Mods API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for mod hosting and version control
 * Handles mod uploads, downloads, versioning, and metadata management
 * 
 * @version 2.0.0 - Migrated to use shared API framework
 * 
 * NOTE: This is a partial migration. Full migration requires:
 * 1. Updating all handlers to use createEnhancedHandler
 * 2. Removing utils/cors.ts and utils/auth.ts (use framework instead)
 * 3. Adding type definitions for mods
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from './utils/errors.js';
import { handleModRoutes } from './router/mod-routes.js';
import { handleAdminRoutes } from './router/admin-routes.js';

/**
 * Route configuration interface
 */
interface RouteConfig {
    pattern: string;
    zone_name: string;
}

/**
 * Parse ROUTES environment variable from JSON string
 * Supports both JSON and TOML-like syntax
 */
function parseRoutes(env: Env): RouteConfig[] {
    if (!env.ROUTES) {
        return [];
    }
    
    try {
        let routesJson = env.ROUTES.trim();
        
        // If it contains TOML syntax (pattern = "value"), convert to JSON
        if (routesJson.includes('=') && !routesJson.includes('":')) {
            // Convert TOML object syntax to JSON
            routesJson = routesJson
                .replace(/\{\s*(\w+)\s*=\s*"([^"]+)"/g, '{"$1": "$2"')
                .replace(/,\s*(\w+)\s*=\s*"([^"]+)"/g, ', "$1": "$2"')
                .replace(/\{\s*(\w+)\s*=\s*(\w+)/g, '{"$1": "$2"')
                .replace(/,\s*(\w+)\s*=\s*(\w+)/g, ', "$1": "$2"');
        }
        
        const parsed = JSON.parse(routesJson);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse ROUTES environment variable:', error);
        return [];
    }
}

/**
 * Get CORS headers (temporary - will be replaced by framework)
 */
function getCorsHeaders(env: Env, request: Request): Record<string, string> {
    const origin = request.headers.get('Origin');
    const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    
    // Check if we're in development (not production)
    // If ENVIRONMENT is not set, assume development (common in local dev)
    const isProduction = env.ENVIRONMENT === 'production';
    const isLocalhost = origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
    
    // If no origins configured OR if localhost in non-production, allow all
    // This ensures localhost works in development without needing to configure ALLOWED_ORIGINS
    let effectiveOrigins = allowedOrigins.length > 0 ? allowedOrigins : ['*'];
    if (!isProduction && isLocalhost && !allowedOrigins.includes('*') && !allowedOrigins.some(o => {
        if (o === '*') return true;
        if (o.endsWith('*')) {
            const prefix = o.slice(0, -1);
            return origin && origin.startsWith(prefix);
        }
        return origin === o;
    })) {
        // Add wildcard to allowed origins for localhost in development
        effectiveOrigins = ['*'];
    }
    
    // Use framework CORS headers (returns Headers object, convert to Record)
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: effectiveOrigins,
    });
    
    // Convert Headers to Record<string, string>
    const headers: Record<string, string> = {};
    corsHeaders.forEach((value, key) => {
        headers[key] = value;
    });
    
    // Ensure Access-Control-Allow-Origin is set (critical for CORS)
    if (!headers['Access-Control-Allow-Origin'] && origin) {
        // If no origin header was set but we have an origin, allow it in development
        if (!isProduction && isLocalhost) {
            headers['Access-Control-Allow-Origin'] = origin;
        } else if (effectiveOrigins.includes('*')) {
            headers['Access-Control-Allow-Origin'] = '*';
        }
    }
    
    return headers;
}

/**
 * Health check endpoint
 */
async function handleHealth(env: Env, request: Request): Promise<Response> {
    const routes = parseRoutes(env);
    
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Mods API is running',
        service: 'strixun-mods-api',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development',
        routes: routes.length > 0 ? routes : undefined
    }), {
        headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request),
        },
    });
}

/**
 * Main request handler with API framework
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
        // Health check (only at /health, not at root to allow root-level mod routes)
        if (path === '/health') {
            return await handleHealth(env, request);
        }

        // Handle admin routes (before mod routes to catch /admin paths)
        if (path.startsWith('/admin')) {
            const adminResult = await handleAdminRoutes(request, path, env);
            if (adminResult) {
                return adminResult.response;
            }
        }

        // Handle mod routes (supports both /mods/* and root-level paths for subdomain routing)
        const modResult = await handleModRoutes(request, path, env);
        if (modResult) {
            return modResult.response;
        }

        // 404 for unknown routes
        const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
        return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeaders(env, request),
            },
        });
    } catch (error: any) {
        console.error('Request handler error:', error);
        
        // Check if it's already an RFC 7807 error
        if (error.status && error.type) {
            return new Response(JSON.stringify(error), {
                status: error.status,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...getCorsHeaders(env, request),
                },
            });
        }
        
        // Check if it's a JWT secret error (configuration issue)
        if (error.message && error.message.includes('JWT_SECRET')) {
            const rfcError = createError(
                request,
                500,
                'Server Configuration Error',
                'JWT_SECRET environment variable is required. Please contact the administrator.'
            );
            return new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...getCorsHeaders(env, request),
                },
            });
        }
        
        // Generic error
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeaders(env, request),
            },
        });
    }
}

/**
 * Export worker with CORS support
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { 
                status: 204,
                headers: getCorsHeaders(env, request),
            });
        }
        
        // Handle request
        return handleRequest(request, env, ctx);
    },
};

/**
 * Environment interface for TypeScript
 */
interface Env {
    // KV Namespaces
    MODS_KV: KVNamespace;
    
    // R2 Buckets
    MODS_R2: R2Bucket;
    
    // Environment variables
    JWT_SECRET?: string; // REQUIRED: JWT signing secret (must match OTP auth service)
    ALLOWED_EMAILS?: string; // REQUIRED: Comma-separated list of allowed email addresses for upload/management
    ALLOWED_ORIGINS?: string; // OPTIONAL: Comma-separated CORS origins (recommended for production)
    ENVIRONMENT?: string;
    MODS_PUBLIC_URL?: string; // OPTIONAL: Public URL for R2 bucket (if using custom domain)
    ROUTES?: string; // OPTIONAL: JSON string array of route configurations (matches wrangler.toml routes)
    
    [key: string]: any;
}

