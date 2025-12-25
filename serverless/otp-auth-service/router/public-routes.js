/**
 * Public Routes
 * Handles public endpoints (no authentication required)
 */

import * as publicHandlers from '../handlers/public.js';
import * as assetHandlers from '../handlers/assets.js';
import { handleEmailTracking } from '../handlers/tracking.js';
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
    // Serve landing page at root
    const isLandingPageRequest = (path === '/' || path === '') && request.method === 'GET';
    
    if (isLandingPageRequest) {
        return assetHandlers.handleLandingPage(request, env);
    }
    
    // Serve dashboard (SPA - all routes serve index.html)
    // This must come before /assets/ check so dashboard assets are handled correctly
    if (path.startsWith('/dashboard') && request.method === 'GET') {
        return assetHandlers.handleDashboard(request, env);
    }
    
    // Handle asset requests - check dashboard assets first, then landing page assets
    // Dashboard HTML references /assets/... which are served from dashboard-assets.js
    // Landing page assets are separate
    const isAssetRequest = path.startsWith('/assets/') && request.method === 'GET';
    
    if (isAssetRequest) {
        // Try dashboard assets first (dashboard HTML references /assets/...)
        const dashboardResponse = await assetHandlers.handleDashboard(request, env);
        // If dashboard handler returns 404, try landing page assets
        if (dashboardResponse.status === 404) {
            return assetHandlers.handleLandingPage(request, env);
        }
        return dashboardResponse;
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
    
    // Public endpoints (no auth required)
    if (path === '/signup' && request.method === 'POST') {
        return publicHandlers.handlePublicSignup(request, env);
    }
    
    if (path === '/signup/verify' && request.method === 'POST') {
        return publicHandlers.handleVerifySignup(request, env);
    }
    
    // Note: /admin/customers POST moved to admin routes - requires super-admin auth
    
    if (path === '/health' && request.method === 'GET') {
        return publicHandlers.handleHealth(request, env);
    }
    
    if (path === '/health/ready' && request.method === 'GET') {
        return publicHandlers.handleHealthReady(request, env);
    }
    
    if (path === '/health/live' && request.method === 'GET') {
        return publicHandlers.handleHealthLive(request, env);
    }
    
    // Email tracking endpoint (for email open tracking)
    if (path === '/track/email-open' && request.method === 'GET') {
        return handleEmailTracking(request, env);
    }
    
    return null; // Route not matched
}

