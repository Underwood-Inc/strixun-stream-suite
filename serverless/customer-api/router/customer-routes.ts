/**
 * Customer Routes
 * Handles all customer API endpoints
 * Uses reusable API architecture with automatic end-to-end encryption
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import { authenticateRequest } from '../utils/auth.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import { handleGetCustomer, handleGetCustomerByEmail, handleCreateCustomer, handleUpdateCustomer } from '../handlers/customer.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Helper to wrap customer route handlers with authentication and automatic encryption
 */
async function handleCustomerRoute(
    handler: (request: Request, env: Env, auth: any) => Promise<Response>,
    request: Request,
    env: Env,
    auth: any
): Promise<RouteResult> {
    // Service calls (service-to-service) are allowed for customer creation
    const isServiceCall = auth?.userId === 'service';
    const isCustomerCreation = request.method === 'POST' && request.url.includes('/customer');
    
    if (!auth && !isServiceCall) {
        const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required. Please provide a valid JWT token or service key.');
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        const errorResponse = new Response(JSON.stringify(rfcError), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        // Use wrapWithEncryption to ensure integrity headers are added for service-to-service calls
        return await wrapWithEncryption(errorResponse, null, request, env);
    }

    // Get handler response
    const handlerResponse = await handler(request, env, auth);

    // Use shared middleware for encryption and integrity headers
    // This automatically:
    // - Encrypts responses if JWT token is present
    // - Adds integrity headers for service-to-service calls
    return await wrapWithEncryption(handlerResponse, auth, request, env);
}

/**
 * Handle customer routes
 * Uses reusable API architecture with automatic encryption
 */
export async function handleCustomerRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Only handle /customer/* routes (or root if this is dedicated customer worker)
    // Allow /customer (without trailing slash) for POST requests
    if (!path.startsWith('/customer/') && path !== '/' && path !== '/customer') {
        return null;
    }

    // Normalize path - if root, treat as /customer/ for dedicated worker
    // Also normalize /customer to /customer/ for consistency
    const normalizedPath = path === '/' ? '/customer/' : (path === '/customer' ? '/customer/' : path);

    // Authenticate request (supports both JWT and service key)
    const auth = await authenticateRequest(request, env);

    // Route to appropriate handler with automatic encryption wrapper
    try {
        // Get customer
        if (normalizedPath === '/customer/me' && request.method === 'GET') {
            return await handleCustomerRoute(handleGetCustomer, request, env, auth);
        }

        // Create customer
        if (normalizedPath === '/customer/' && request.method === 'POST') {
            return await handleCustomerRoute(handleCreateCustomer, request, env, auth);
        }

        // Update customer
        if (normalizedPath === '/customer/me' && request.method === 'PUT') {
            return await handleCustomerRoute(handleUpdateCustomer, request, env, auth);
        }

        // Get customer by email
        const emailMatch = normalizedPath.match(/^\/customer\/by-email\/(.+)$/);
        if (emailMatch && request.method === 'GET') {
            const email = decodeURIComponent(emailMatch[1]);
            return await handleCustomerRoute(
                (req, e, a) => handleGetCustomerByEmail(req, e, a, email),
                request,
                env,
                auth
            );
        }

        // Update customer by ID (for service calls)
        const customerIdMatch = normalizedPath.match(/^\/customer\/([^\/]+)$/);
        if (customerIdMatch) {
            const customerId = customerIdMatch[1];
            if (request.method === 'GET') {
                return await handleCustomerRoute(
                    (req, e, a) => handleGetCustomer(req, e, a, customerId),
                    request,
                    env,
                    auth
                );
            }
            if (request.method === 'PUT') {
                // For service calls, allow updating by ID
                const { handleUpdateCustomerById } = await import('../handlers/customer.js');
                return await handleCustomerRoute(
                    (req, e, a) => handleUpdateCustomerById(req, e, a, customerId),
                    request,
                    env,
                    auth
                );
            }
        }

        return null; // Route not matched
    } catch (error: any) {
        console.error('Customer route error:', error);
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
        // Use wrapWithEncryption to ensure integrity headers are added for service-to-service calls
        return await wrapWithEncryption(errorResponse, auth, request, env);
    }
}

