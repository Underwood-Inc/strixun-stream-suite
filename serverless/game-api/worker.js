/**
 * Game API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for idle game API endpoints
 * Handles all game-related operations with JWT authentication
 * 
 * @version 1.0.0
 */

import { handleGameRoutes } from './router/game-routes.js';
import { getCorsHeaders } from './utils/cors.js';

/**
 * Health check endpoint
 */
async function handleHealth(env, request) {
    return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Game API is running',
        service: 'strixun-game-api',
        endpoints: 23,
        timestamp: new Date().toISOString()
    }), {
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: getCorsHeaders(env, request) });
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
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Request handler error:', error);
            
            // Check if it's a JWT secret error (configuration issue)
            if (error.message && error.message.includes('JWT_SECRET')) {
                return new Response(JSON.stringify({ 
                    error: 'Server configuration error',
                    message: 'JWT_SECRET environment variable is required. Please contact the administrator.',
                    details: 'The server is not properly configured. JWT_SECRET must be set via: wrangler secret put JWT_SECRET'
                }), {
                    status: 500,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
            
            return new Response(JSON.stringify({ 
                error: 'Internal server error', 
                message: env.ENVIRONMENT === 'development' ? error.message : undefined 
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
    },
};

