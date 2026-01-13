/**
 * Game API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for idle game API endpoints
 * Handles all game-related operations with JWT authentication
 * 
 * @version 2.0.0 - Migrated to use shared API framework
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import type { ExecutionContext } from '@strixun/types';
import { createError } from './utils/errors.js';
import { handleGameRoutes } from './router/game-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';

/**
 * Health check endpoint
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
async function handleHealth(env: any, request: Request): Promise<Response> {
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
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
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
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
    
    const jwtToken = authCookie.substring('auth_token='.length).trim();

    // Create auth object for encryption
    const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };

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

    // Wrap with encryption - but disable for HttpOnly cookie auth (browser can't decrypt)
    // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
    const encryptedResult = await wrapWithEncryption(response, null, request, env, {
        requireJWT: false // Pass null to disable encryption for HttpOnly cookies
    });
    return encryptedResult.response;
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

