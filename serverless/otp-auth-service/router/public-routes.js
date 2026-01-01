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
    
    // Serve OpenAPI spec - requires JWT encryption
    if (path === '/openapi.json' && request.method === 'GET') {
        // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
        // Get JWT token from request
        const authHeader = request.headers.get('Authorization');
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        
        if (!jwtToken) {
            const errorResponse = {
                type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
                title: 'Unauthorized',
                status: 401,
                detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
                instance: request.url
            };
            const corsHeaders = getCorsHeaders(env, request);
            return new Response(JSON.stringify(errorResponse), {
                status: 401,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...corsHeaders,
                },
            });
        }

        try {
            const response = new Response(JSON.stringify(openApiSpec, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600',
                },
            });
            
            // Wrap with encryption
            const { wrapWithEncryption } = await import('@strixun/api-framework');
            const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
            const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
            return encryptedResult.response;
        } catch (error) {
            const errorResponse = new Response(JSON.stringify({ error: 'Failed to load OpenAPI spec' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
            
            // Wrap error response with encryption
            const { wrapWithEncryption } = await import('@strixun/api-framework');
            const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
            const encryptedError = await wrapWithEncryption(errorResponse, authForEncryption, request, env, { requireJWT: false });
            return encryptedError.response;
        }
    }
    
    // Public endpoints (no auth required, but responses should be encrypted if JWT provided)
    // These endpoints are part of signup flow and don't generate JWTs, but we allow optional encryption
    if (path === '/signup' && request.method === 'POST') {
        const handlerResponse = await publicHandlers.handlePublicSignup(request, env);
        // Extract JWT token if present (optional - signup doesn't require JWT)
        const authHeader = request.headers.get('Authorization');
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        const authForEncryption = jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null;
        
        // Use requireJWT: false for signup endpoints (user doesn't have account yet)
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env,
            { requireJWT: false } // ⚠️ Exception - part of signup flow
        );
        return encryptedResult.response;
    }
    
    if (path === '/signup/verify' && request.method === 'POST') {
        const handlerResponse = await publicHandlers.handleVerifySignup(request, env);
        // Extract JWT token if present (optional - signup doesn't require JWT)
        const authHeader = request.headers.get('Authorization');
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        const authForEncryption = jwtToken ? { userId: 'anonymous', customerId: null, jwtToken } : null;
        
        // Use requireJWT: false for signup endpoints (may return JWT)
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env,
            { requireJWT: false } // ⚠️ Exception - may return JWT
        );
        return encryptedResult.response;
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

