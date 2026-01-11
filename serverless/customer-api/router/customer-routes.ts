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
import { handleGetPreferences, handleUpdatePreferences, handleUpdateDisplayName } from '../handlers/preferences.js';
import { handleListAllCustomers } from '../handlers/admin.js';

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
    // Auth is always provided (either JWT or service-to-service minimal auth)
    // No need to check for null

    // Get handler response
    const handlerResponse = await handler(request, env, auth);

    // Use shared middleware for encryption and integrity headers
    // This automatically:
    // - Encrypts responses if JWT token is present
    // - Adds integrity headers for internal calls
    // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
    return await wrapWithEncryption(handlerResponse, auth, request, env, {
        allowServiceCallsWithoutJWT: true
    });
}

/**
 * Handle customer routes
 * Uses reusable API architecture with automatic encryption
 */
export async function handleCustomerRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Handle /admin/* routes first (more specific)
    if (path.startsWith('/admin/')) {
        // Admin routes require SUPER_ADMIN_API_KEY for service-to-service authentication
        const authHeader = request.headers.get('Authorization');
        const superAdminKey = env.SUPER_ADMIN_API_KEY;
        
        // Verify super-admin authentication
        if (!authHeader || !authHeader.startsWith('Bearer ') || !superAdminKey) {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify({
                    error: 'Super-admin authentication required',
                    detail: 'Admin endpoints require SUPER_ADMIN_API_KEY authentication'
                }), {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                }),
                customerId: null
            };
        }
        
        const providedKey = authHeader.substring(7).trim();
        if (providedKey !== superAdminKey) {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify({
                    error: 'Invalid super-admin key',
                    detail: 'The provided SUPER_ADMIN_API_KEY is invalid'
                }), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                }),
                customerId: null
            };
        }
        
        // Create service auth object for admin calls
        const auth = {
            userId: 'super-admin',
            customerId: null,
            jwtToken: '', // No JWT for service calls
        };
        
        // Route admin endpoints
        if (path === '/admin/customers' && request.method === 'GET') {
            return await handleCustomerRoute(handleListAllCustomers, request, env, auth);
        }
        
        // Admin route not found
        return null;
    }
    
    // Only handle /customer/* routes (or root if this is dedicated customer worker)
    // Allow /customer (without trailing slash) for POST requests
    if (!path.startsWith('/customer/') && path !== '/' && path !== '/customer') {
        return null;
    }

    // Normalize path - if root, treat as /customer/ for dedicated worker
    // Also normalize /customer to /customer/ for consistency
    const normalizedPath = path === '/' ? '/customer/' : (path === '/customer' ? '/customer/' : path);

    // Authenticate request - JWT for user requests, optional for internal calls
    // Internal calls (no Authorization header) are allowed for internal operations
    let auth = await authenticateRequest(request, env);
    
    // If no JWT auth, allow unauthenticated internal calls
    // This is needed during OTP verification when no JWT exists yet
    if (!auth) {
        // Create a minimal auth object for internal calls
        auth = {
            userId: 'service',
            customerId: null,
            jwtToken: '', // No JWT for service calls
        };
    }

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

        // Get customer preferences
        const preferencesMatch = normalizedPath.match(/^\/customer\/([^\/]+)\/preferences$/);
        if (preferencesMatch && request.method === 'GET') {
            const customerId = preferencesMatch[1];
            return await handleCustomerRoute(
                (req, e, a) => handleGetPreferences(req, e, a, customerId),
                request,
                env,
                auth
            );
        }

        // Update customer preferences
        if (preferencesMatch && request.method === 'PUT') {
            const customerId = preferencesMatch[1];
            return await handleCustomerRoute(
                (req, e, a) => handleUpdatePreferences(req, e, a, customerId),
                request,
                env,
                auth
            );
        }

        // Update customer display name
        const displayNameMatch = normalizedPath.match(/^\/customer\/([^\/]+)\/display-name$/);
        if (displayNameMatch && request.method === 'PUT') {
            const customerId = displayNameMatch[1];
            return await handleCustomerRoute(
                (req, e, a) => handleUpdateDisplayName(req, e, a, customerId),
                request,
                env,
                auth
            );
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
        // Use wrapWithEncryption to ensure integrity headers are added for internal calls
        // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
        return await wrapWithEncryption(errorResponse, auth, request, env, {
            allowServiceCallsWithoutJWT: true
        });
    }
}

