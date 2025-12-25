/**
 * Game API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for idle game API endpoints
 * Handles all game-related operations with JWT authentication
 * 
 * @version 2.0.0 - Migrated to use shared API framework
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from './utils/errors.js';
import { handleGameRoutes } from './router/game-routes.js';

/**
 * Health check endpoint
 */
async function handleHealth(env: any, request: Request): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Game API is running',
        service: 'strixun-game-api',
        endpoints: 23,
        timestamp: new Date().toISOString()
    }), {
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });
}

/**
 * Main request handler
 */
export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(null, { headers: Object.fromEntries(corsHeaders.entries()) });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Health check
            if (path === '/health' || path === '/') {
                return await handleHealth(env, request);
            }

            // Handle game routes
            const gameResult = await handleGameRoutes(request, path, env);
            if (gameResult) {
                return gameResult.response;
            }

            // 404 for unknown routes
            const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
            const corsHeaders404 = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders404.entries()),
                },
            });
        } catch (error: any) {
            console.error('Request handler error:', error);
            
            // Check if it's a JWT secret error (configuration issue)
            if (error.message && error.message.includes('JWT_SECRET')) {
                const rfcError = createError(
                    request,
                    500,
                    'Server Configuration Error',
                    'JWT_SECRET environment variable is required. Please contact the administrator.'
                );
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
            
            const rfcError = createError(
                request,
                500,
                'Internal Server Error',
                env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
            );
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
    },
};

