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

/**
 * Get CORS headers (temporary - will be replaced by framework)
 */
function getCorsHeaders(env: Env, request: Request): Record<string, string> {
    // Use framework CORS headers
    return createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
}

/**
 * Health check endpoint
 */
async function handleHealth(env: Env, request: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Mods API is running',
        service: 'strixun-mods-api',
        timestamp: new Date().toISOString()
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
        // Health check
        if (path === '/health' || path === '/') {
            return await handleHealth(env, request);
        }

        // Handle mod routes
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
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    MODS_PUBLIC_URL?: string; // Public URL for R2 bucket (if using custom domain)
    
    [key: string]: any;
}

