/**
 * Access Service Worker
 * 
 * Handles access control decisions, roles, permissions, and quotas.
 * Service-agnostic: works for ANY service (mods, customer, analytics, etc.)
 * 
 * Key Principles:
 * - Service-to-service authentication (X-Service-Key required for all endpoints)
 * - No customer data storage (only references customerId)
 * - No business logic (only access control decisions)
 * - Service-agnostic (resource types are generic strings)
 */

import type { Env } from './types/authorization.js';
import { handleAccessRoutes } from './router/access-routes.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * Main worker entry point
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // Health check endpoint
        if (path === '/health' || path === '/health/ready') {
            return new Response(JSON.stringify({
                status: 'healthy',
                service: 'access-service',
                timestamp: new Date().toISOString(),
                environment: env.ENVIRONMENT || 'production',
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: Object.fromEntries(createCORSHeaders(request, env).entries()),
            });
        }

        // Route to access control handlers
        try {
            const result = await handleAccessRoutes(request, path, env);
            
            if (result) {
                return result.response;
            }

            // 404: Route not found
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Route ${path} not found`,
                code: 'ROUTE_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        } catch (error) {
            console.error('[AccessWorker] Unhandled error:', error);
            
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'INTERNAL_ERROR',
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
    },
};
