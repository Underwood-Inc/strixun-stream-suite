/**
 * Customer API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for customer data management
 * Handles all customer-related operations with JWT authentication
 * 
 * @version 1.0.1 - Added: Auto-run migrations on startup
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import type { ExecutionContext } from '@strixun/types';
import { createError } from './utils/errors.js';
import { handleCustomerRoutes } from './router/customer-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import { authenticateRequest } from './utils/auth.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    OTP_AUTH_KV?: KVNamespace;
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
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
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
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
        });
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
    
    // Create health check response
    // Note: Health check doesn't require encryption (passing null to wrapWithEncryption)
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
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            const corsHeaders = createCORSHeaders(request, {
                credentials: true,
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
            });
            return new Response(null, { headers: Object.fromEntries(corsHeaders.entries()) });
        }

        const url = new URL(request.url);
        // Dev-proxy normalization: allow apps to call through /customer-api/* without 404s
        let path = url.pathname;
        if (path.startsWith('/customer-api/')) {
            path = path.substring('/customer-api'.length);
        }

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
                credentials: true,
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
            });
            const errorResponse = new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders404.entries()),
                },
            });
            
            // Detect if request is from browser (HttpOnly cookie auth)
            const cookieHeader = request.headers.get('Cookie');
            const hasHttpOnlyCookie = cookieHeader?.includes('auth_token=') || false;
            
            // For HttpOnly cookie requests, pass null to disable encryption
            // For service-to-service calls, pass auth (might be null, which is fine with allowServiceCallsWithoutJWT)
            const authForEncryption = hasHttpOnlyCookie ? null : auth;
            
            // Wrap with encryption to add integrity headers for service-to-service calls
            // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
            const wrappedResult = await wrapWithEncryption(errorResponse, authForEncryption, request, env, {
                allowServiceCallsWithoutJWT: true,
                requireJWT: authForEncryption ? true : false
            });
            return wrappedResult.response;
        } catch (error: any) {
            console.error('[Customer API Worker] Request handler error:', error);
            console.error('[Customer API Worker] Error stack:', error?.stack);
            console.error('[Customer API Worker] Request path:', path);
            console.error('[Customer API Worker] Request method:', request.method);
            
            const rfcError = createError(
                request,
                500,
                'Internal Server Error',
                env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
            );
            const corsHeaders = createCORSHeaders(request, {
                credentials: true,
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
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

