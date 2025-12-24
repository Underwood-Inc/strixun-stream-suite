/**
 * Public Routes
 * Handles public endpoints (no authentication required)
 */

import * as publicHandlers from '../handlers/public.js';
import * as assetHandlers from '../handlers/assets.js';
import openApiSpec from '../openapi-json.js';
import { getCorsHeaders } from '../utils/cors.js';

/**
 * Handle public routes
 * @param {Request} request - HTTP request
 * @param {string} path - Request path
 * @param {*} env - Worker environment
 * @returns {Response|null} Response if route matched, null otherwise
 */
export async function handlePublicRoutes(request, path, env) {
    // Serve landing page at root and all asset paths
    const isLandingPageRequest = (path === '/' || path === '') && request.method === 'GET';
    const isLandingPageAsset = path.startsWith('/assets/') && request.method === 'GET';
    
    if (isLandingPageRequest || isLandingPageAsset) {
        return assetHandlers.handleLandingPage(request, env);
    }
    
    // Serve OpenAPI spec
    if (path === '/openapi.json' && request.method === 'GET') {
        try {
            return new Response(JSON.stringify(openApiSpec, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600',
                    ...getCorsHeaders(env, request),
                },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to load OpenAPI spec' }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
    }
    
    // Serve dashboard (SPA - all routes serve index.html)
    if (path.startsWith('/dashboard') && request.method === 'GET') {
        return assetHandlers.handleDashboard(request, env);
    }
    
    // Public endpoints (no auth required)
    if (path === '/signup' && request.method === 'POST') {
        return publicHandlers.handlePublicSignup(request, env);
    }
    
    if (path === '/signup/verify' && request.method === 'POST') {
        return publicHandlers.handleVerifySignup(request, env);
    }
    
    if (path === '/admin/customers' && request.method === 'POST') {
        return publicHandlers.handleRegisterCustomer(request, env);
    }
    
    if (path === '/health' && request.method === 'GET') {
        return publicHandlers.handleHealth(request, env);
    }
    
    if (path === '/health/ready' && request.method === 'GET') {
        return publicHandlers.handleHealthReady(request, env);
    }
    
    if (path === '/health/live' && request.method === 'GET') {
        return publicHandlers.handleHealthLive(request, env);
    }
    
    return null; // Route not matched
}

