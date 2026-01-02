/**
 * Customer API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for customer data management
 * Handles all customer-related operations with JWT authentication
 * 
 * @version 1.0.0
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import type { ExecutionContext } from '@strixun/types';
import { createError } from './utils/errors.js';
import { handleCustomerRoutes } from './router/customer-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import { authenticateRequest } from './utils/auth.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

/**
 * Health check endpoint
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
async function handleHealth(env: Env, request: Request): Promise<Response> {
    // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
    // Get JWT token from request
    const authHeader = request.headers.get('Authorization');
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!jwtToken) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
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

    // Authenticate request to get auth object for encryption
    const auth = await authenticateRequest(request, env);
    const authForEncryption = auth ? { ...auth, jwtToken } : { userId: 'anonymous', customerId: null, jwtToken };

    // Create health check response
    const healthData = { 
        status: 'ok', 
        message: 'Customer API is running',
        service: 'strixun-customer-api',
        timestamp: new Date().toISOString()
    };
    
    const response = new Response(JSON.stringify(healthData), {
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Wrap with encryption to ensure JWT encryption is applied
    const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
    return encryptedResult.response;
}

/**
 * Main request handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

            // Handle customer routes (they authenticate internally)
            const customerResult = await handleCustomerRoutes(request, path, env);
            if (customerResult) {
                return customerResult.response;
            }

            // 404 for unknown routes
            const auth = null;
            
            const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
            const corsHeaders404 = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            const errorResponse = new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders404.entries()),
                },
            });
            
            // Wrap with encryption to add integrity headers for service-to-service calls
            // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
            const wrappedResult = await wrapWithEncryption(errorResponse, auth, request, env, {
                allowServiceCallsWithoutJWT: true
            });
            return wrappedResult.response;
        } catch (error: any) {
            console.error('[Customer API Worker] Request handler error:', error);
            console.error('[Customer API Worker] Error stack:', error?.stack);
            console.error('[Customer API Worker] Request path:', path);
            console.error('[Customer API Worker] Request method:', request.method);
            
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
                const errorResponse = new Response(JSON.stringify(rfcError), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
                // CRITICAL: Allow service-to-service calls without JWT
                const wrappedResult = await wrapWithEncryption(errorResponse, null, request, env, {
                    allowServiceCallsWithoutJWT: true
                });
                return wrappedResult.response;
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
            const errorResponse = new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
            // CRITICAL: Allow service-to-service calls without JWT
            const wrappedResult = await wrapWithEncryption(errorResponse, null, request, env, {
                allowServiceCallsWithoutJWT: true
            });
            return wrappedResult.response;
        }
    },
};

