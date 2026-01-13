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
import { handleListAllCustomers, handleGetCustomerDetails, handleUpdateCustomer as handleAdminUpdateCustomer } from '../handlers/admin.js';

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

    // Detect if request is from browser (HttpOnly cookie auth)
    const cookieHeader = request.headers.get('Cookie');
    const hasHttpOnlyCookie = cookieHeader?.includes('auth_token=') || false;
    
    // CRITICAL: Disable encryption for browser requests (HttpOnly cookies)
    // Browsers can't access HttpOnly cookies to decrypt responses
    // For service-to-service calls (Authorization header), encryption is enabled
    const authForEncryption = hasHttpOnlyCookie ? null : auth;

    // Use shared middleware for encryption and integrity headers
    // This automatically:
    // - Encrypts responses if JWT token is present (service-to-service only)
    // - Adds integrity headers for internal calls
    // - For browser requests: passes null to disable encryption
    // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
    return await wrapWithEncryption(handlerResponse, authForEncryption, request, env, {
        allowServiceCallsWithoutJWT: true,
        requireJWT: authForEncryption ? true : false // Only require JWT if we have auth to encrypt with
    });
}

/**
 * Handle customer routes
 * Uses reusable API architecture with automatic encryption
 */
export async function handleCustomerRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Handle /admin/* routes first (more specific)
    if (path.startsWith('/admin/')) {
        // Admin routes require JWT authentication + super-admin role check via access-service
        const auth = await authenticateRequest(request, env);
        
        if (!auth || !auth.customerId) {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify({
                    error: 'Authentication required',
                    detail: 'Admin endpoints require JWT authentication'
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
        
        // Check if customer has super-admin role via access-service
        const { AccessClient } = await import('../../shared/access-client.js');
        
        console.log('[CustomerRoutes] Checking super-admin with JWT:', {
            hasJwtToken: !!auth.jwtToken,
            jwtLength: auth.jwtToken?.length,
            accessUrl: env.ACCESS_SERVICE_URL,
            customerId: auth.customerId
        });
        
        const accessClient = new AccessClient(env, {
            jwtToken: auth.jwtToken, // Pass JWT token for authentication (REQUIRED)
        });
        
        const isSuperAdmin = await accessClient.isSuperAdmin(auth.customerId!);
        
        if (!isSuperAdmin) {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify({
                    error: 'Forbidden',
                    detail: 'Super-admin role required for admin endpoints'
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
        
        // Route admin endpoints
        if (path === '/admin/customers' && request.method === 'GET') {
            return await handleCustomerRoute(handleListAllCustomers, request, env, auth);
        }
        
        // GET /admin/customers/:customerId - Get customer details
        const adminCustomerIdMatch = path.match(/^\/admin\/customers\/([^\/]+)$/);
        if (adminCustomerIdMatch && request.method === 'GET') {
            const customerId = adminCustomerIdMatch[1];
            return await handleCustomerRoute(
                (req, e, a) => handleGetCustomerDetails(req, e, a, customerId),
                request,
                env,
                auth
            );
        }
        
        // PUT /admin/customers/:customerId - Update customer
        if (adminCustomerIdMatch && request.method === 'PUT') {
            const customerId = adminCustomerIdMatch[1];
            return await handleCustomerRoute(
                (req, e, a) => handleAdminUpdateCustomer(req, e, a, customerId),
                request,
                env,
                auth
            );
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
        // Detect if request is from browser (HttpOnly cookie auth)
        const cookieHeader = request.headers.get('Cookie');
        const hasHttpOnlyCookie = cookieHeader?.includes('auth_token=') || false;
        
        // For HttpOnly cookie requests, pass null to disable encryption
        // For service-to-service calls, pass auth (might be null, which is fine with allowServiceCallsWithoutJWT)
        const authForEncryption = hasHttpOnlyCookie ? null : (auth as any);
        
        // Use wrapWithEncryption to ensure integrity headers are added for internal calls
        // CRITICAL: Allow service-to-service calls without JWT (needed for OTP auth service)
        return await wrapWithEncryption(errorResponse, authForEncryption, request, env, {
            allowServiceCallsWithoutJWT: true,
            requireJWT: authForEncryption ? true : false
        });
    }
}

