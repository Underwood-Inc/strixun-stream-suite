/**
 * Game API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for idle game API endpoints
 * Handles all game-related operations with JWT authentication
 * 
 * @version 2.2.0 - Added migration architecture
 */

import type { ExecutionContext } from '@strixun/types';
import { createError } from './utils/errors.js';
import { getCorsHeaders } from './utils/cors.js';
import { handleGameRoutes } from './router/game-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';

/**
 * Health check endpoint
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
async function handleHealth(env: any, request: Request): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    
    // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
    // ONLY check HttpOnly cookie - NO fallbacks, NO Authorization header
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
            instance: request.url
        };
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...corsHeaders,
            },
        });
    }
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
            instance: request.url
        };
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...corsHeaders,
            },
        });
    }
    
    const jwtToken = authCookie.substring('auth_token='.length).trim();

    // Create health check response
    const healthData = { 
        status: 'ok', 
        message: 'Game API is running',
        service: 'strixun-game-api',
        endpoints: 23,
        timestamp: new Date().toISOString()
    };
    
    const response = new Response(JSON.stringify(healthData), {
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // CRITICAL: Detect if request is using HttpOnly cookie (browser request)
    // If yes, we must disable response encryption because JavaScript can't access HttpOnly cookies to decrypt
    // For HttpOnly cookie requests, pass null to disable encryption
    // For Authorization header requests (service-to-service), pass auth object to enable encryption
    const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
    const authForEncryption = isHttpOnlyCookie ? null : {
        userId: 'anonymous',
        customerId: null,
        jwtToken
    };

    // Wrap with encryption - disable for HttpOnly cookie auth (browser can't decrypt)
    // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
    const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env, {
        requireJWT: authForEncryption ? true : false
    });
    return encryptedResult.response;
}

/**
 * Main request handler
 */
export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        const corsHeaders = getCorsHeaders(env, request);
        
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Use service binding for JWKS fetch when available (avoids same-zone 522 to auth.idling.app)
        const envForRequest = env.AUTH_SERVICE
            ? { ...env, JWKS_FETCH: (url: string) => env.AUTH_SERVICE.fetch(url) }
            : env;

        const url = new URL(request.url);
        // Dev-proxy normalization: allow apps to call through /game-api/* without 404s
        let path = url.pathname;
        if (path.startsWith('/game-api/')) {
            path = path.substring('/game-api'.length);
        }

        try {
            // Health check
            if (path === '/health' || path === '/') {
                return await handleHealth(env, request);
            }

            // Handle game routes
            const gameResult = await handleGameRoutes(request, path, envForRequest);
            if (gameResult) {
                return gameResult.response;
            }

            // 404 for unknown routes
            const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...corsHeaders,
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
                return new Response(JSON.stringify(rfcError), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...corsHeaders,
                    },
                });
            }
            
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
                    ...corsHeaders,
                },
            });
        }
    },
};
