/**
 * Dashboard Routes
 * Handles customer dashboard endpoints for the OTP auth service
 * 
 * Most routes are customer-scoped and only require regular authentication.
 * Customers can access their own data (analytics, audit logs, API keys, etc.)
 * 
 * Some routes require super-admin authentication (for system-level operations):
 * - API key: SUPER_ADMIN_API_KEY
 * - Email-based: SUPER_ADMIN_EMAILS (comma-separated list)
 * 
 * Note: Super-admin is for mods-hub dashboard, not OTP auth dashboard.
 * These routes are for the OTP auth customer dashboard.
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyApiKey } from '../services/api-key.js';
import { verifyJWT, getJWTSecret, hashEmail } from '../utils/crypto.js';
import { getCustomerKey, getCustomerByEmail } from '../services/customer.js';
import { requireSuperAdmin } from '../utils/super-admin.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import * as adminHandlers from '../handlers/admin.js';
import * as domainHandlers from '../handlers/domain.js';
import * as publicHandlers from '../handlers/public.js';
import * as debugHandlers from '../handlers/auth/debug.js';
import * as dataRequestHandlers from '../handlers/admin/data-requests.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    SUPER_ADMIN_API_KEY?: string;
    SUPER_ADMIN_EMAILS?: string;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface ApiKeyAuth {
    customerId: string;
    keyId: string;
}

interface JwtAuth {
    customerId: string | null;
    jwtToken: string;
}

type AuthResult = ApiKeyAuth | JwtAuth | null;

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Authenticate request using API key or JWT token
 * Supports both authentication methods for backward compatibility and dashboard access
 */
async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        token = authHeader.substring(7).trim();
    } else {
        // Try X-OTP-API-Key header for API key authentication
        const apiKey = request.headers.get('X-OTP-API-Key');
        if (apiKey) {
            return await verifyApiKey(apiKey, env);
        }
        return null;
    }
    
    if (!token) {
        return null;
    }
    
    // Try API key verification (for backward compatibility)
    const apiKeyAuth = await verifyApiKey(token, env);
    if (apiKeyAuth) {
        return apiKeyAuth;
    }
    
    // If API key verification fails, try JWT token verification (for dashboard access)
    try {
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return null;
        }
        
        // Check if token is blacklisted (for security)
        const customerId = payload.customerId || null;
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        const blacklisted = await env.OTP_AUTH_KV.get(blacklistKey);
        if (blacklisted) {
            return null; // Token has been revoked
        }
        
        // Ensure customer account exists (handles backwards compatibility)
        // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
        let resolvedCustomerId = customerId;
        if (payload.email) {
            try {
                // Import ensureCustomerAccount function
                const { ensureCustomerAccount } = await import('../handlers/auth/customer-creation.js');
                resolvedCustomerId = await ensureCustomerAccount(payload.email, customerId, env);
            } catch (error) {
                console.error(`[Admin Routes] Failed to ensure customer account for ${payload.email}:`, error);
                // If customer account creation fails, authentication fails
                return null;
            }
        }
        
        // Verify customer exists and is active
        if (!resolvedCustomerId) {
            return null; // JWT must have customerId for admin endpoints
        }
        
        // Return auth object in same format as API key auth
        return {
            customerId: resolvedCustomerId,
            jwtToken: token, // Include JWT token for encryption
        };
    } catch (error) {
        // JWT verification failed
        return null;
    }
}

/**
 * Helper to wrap super-admin route handlers with super-admin check, customerId tracking and encryption
 * Used only for routes that require super-admin authentication
 */
async function handleSuperAdminRoute(
    handler: (request: Request, env: Env, customerId: string | null) => Promise<Response>,
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<RouteResult> {
    // First, check super-admin authentication
    const superAdminError = await requireSuperAdmin(request, env);
    if (superAdminError) {
        return { 
            response: superAdminError, 
            customerId: null 
        };
    }
    
    // If requireSuperAdmin passed but auth is null, check if it's an internal call with SUPER_ADMIN_API_KEY
    if (!auth) {
        // Verify this is actually a SUPER_ADMIN_API_KEY call (not a JWT that failed other checks)
        const { verifySuperAdmin } = await import('../utils/super-admin.js');
        const authHeader = request.headers.get('Authorization');
        let isSuperAdminKey = false;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // CRITICAL: Trim token to ensure it matches the token used for encryption
            const token = authHeader.substring(7).trim();
            isSuperAdminKey = verifySuperAdmin(token, env);
        } else {
            const apiKey = request.headers.get('X-OTP-API-Key');
            if (apiKey) {
                isSuperAdminKey = verifySuperAdmin(apiKey, env);
            }
        }
        
        if (isSuperAdminKey) {
            // Internal call with SUPER_ADMIN_API_KEY - allow with null customerId
            // The handler accepts null customerId and will perform system-wide operations
            const handlerResponse = await handler(request, env, null);
            return { response: handlerResponse, customerId: null };
        }
        
        // Not an internal call - require normal authentication
        // Try to get more context from JWT token for better error message
        let errorMessage = 'Authentication required. Please log in to access the dashboard.';
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // CRITICAL: Trim token to ensure it matches the token used for encryption
            const token = authHeader.substring(7).trim();
            try {
                const jwtSecret = getJWTSecret(env);
                const payload = await verifyJWT(token, jwtSecret);
                if (payload && !payload.customerId) {
                    errorMessage = 'No customer account found for your email. Please sign up at /signup to create a customer account first.';
                } else if (payload && payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                    errorMessage = 'Your session has expired. Please log in again.';
                }
            } catch (e) {
                // Invalid token, use default message
            }
        }
        
        return { 
            response: new Response(JSON.stringify({ 
                error: errorMessage,
                code: 'AUTHENTICATION_REQUIRED'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), 
            customerId: null 
        };
    }
    
    // Get handler response
    const handlerResponse = await handler(request, env, auth.customerId);
    
    // Use shared middleware for encryption and integrity headers
    // This automatically:
    // - Encrypts responses if JWT token is present
    // - Adds integrity headers for internal calls
    return await wrapWithEncryption(handlerResponse, auth, request, env);
}

/**
 * Handle dashboard routes
 * Most routes are customer-scoped and only require regular authentication.
 * Some routes require super-admin authentication (marked in comments).
 */
export async function handleDashboardRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Super-admin endpoint: Create customer (requires super-admin API key)
    if (path === '/admin/customers' && request.method === 'POST') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        // Super-admin authenticated, allow customer creation
        return { response: await publicHandlers.handleRegisterCustomer(request, env), customerId: null };
    }
    
    // All other admin endpoints require super-admin + regular auth
    // DEPRECATED: Customer admin endpoints - use /customer/me from customer-api instead
    // These endpoints were consolidated into customer-api for proper separation of concerns
    if (path === '/admin/customers/me') {
        const corsHeaders = getCorsHeaders(env, request);
        const errorResponse = new Response(JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.9',
            title: 'Gone',
            status: 410,
            detail: 'This endpoint has been deprecated. Please use /customer/me from customer-api instead. OTP auth service handles authentication, customer-api handles customer data.',
            instance: request.url,
        }), {
            status: 410,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        const auth = await authenticateRequest(request, env);
        return {
            response: await wrapWithEncryption(errorResponse, auth, request, env, { allowServiceCallsWithoutJWT: true }),
            customerId: auth && 'customerId' in auth ? auth.customerId : null,
        };
    }
    
    // Domain verification endpoints
    if (path === '/admin/domains/verify' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(domainHandlers.handleRequestDomainVerification, request, env, auth);
    }
    
    const domainStatusMatch = path.match(/^\/admin\/domains\/([^\/]+)\/status$/);
    if (domainStatusMatch && request.method === 'GET') {
        const domain = domainStatusMatch[1];
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        return { response: await domainHandlers.handleGetDomainStatus(request, env, domain), customerId: auth.customerId };
    }
    
    const domainVerifyMatch = path.match(/^\/admin\/domains\/([^\/]+)\/verify$/);
    if (domainVerifyMatch && request.method === 'POST') {
        const domain = domainVerifyMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => domainHandlers.handleVerifyDomain(req, e, cid, domain), request, env, auth);
    }
    
    // Analytics endpoints - customer-scoped, regular auth required (not super-admin)
    // These endpoints filter by customerId, so users only see their own analytics
    if (path === '/admin/analytics' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        const handlerResponse = await adminHandlers.handleGetAnalytics(request, env, auth.customerId);
        return await wrapWithEncryption(handlerResponse, auth, request, env);
    }
    
    if (path === '/admin/analytics/realtime' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        const handlerResponse = await adminHandlers.handleGetRealtimeAnalytics(request, env, auth.customerId);
        return await wrapWithEncryption(handlerResponse, auth, request, env);
    }
    
    if (path === '/admin/analytics/errors' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        const handlerResponse = await adminHandlers.handleGetErrorAnalytics(request, env, auth.customerId);
        return await wrapWithEncryption(handlerResponse, auth, request, env);
    }
    
    if (path === '/admin/analytics/email' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        const handlerResponse = await adminHandlers.handleGetEmailAnalytics(request, env, auth.customerId);
        return await wrapWithEncryption(handlerResponse, auth, request, env);
    }
    
    // Onboarding endpoints
    if (path === '/admin/onboarding' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetOnboarding, request, env, auth);
    }
    
    if (path === '/admin/onboarding' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleUpdateOnboarding, request, env, auth);
    }
    
    if (path === '/admin/onboarding/test-otp' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute(adminHandlers.handleTestOTP, request, env, auth);
    }
    
    // User Management endpoints
    if (path === '/admin/users' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleListUsers, request, env, auth);
    }
    
    // GDPR endpoints
    const exportUserMatch = path.match(/^\/admin\/users\/([^\/]+)\/export$/);
    if (exportUserMatch && request.method === 'GET') {
        const userId = exportUserMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute((req, e, cid) => adminHandlers.handleExportUserData(req, e, cid, userId), request, env, auth);
    }
    
    const deleteUserMatch = path.match(/^\/admin\/users\/([^\/]+)$/);
    if (deleteUserMatch && request.method === 'DELETE') {
        const userId = deleteUserMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => adminHandlers.handleDeleteUserData(req, e, cid, userId), request, env, auth);
    }
    
    // Audit logs endpoint - customer-scoped, regular auth required (not super-admin)
    // Customers can only access their own audit logs, filtered by customerId
    if (path === '/admin/audit-logs' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth || !auth.customerId) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED',
                    message: auth && !auth.customerId 
                        ? 'No customer account found. Please sign up to create a customer account first.'
                        : 'Please log in to access your audit logs.'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        const handlerResponse = await adminHandlers.handleGetAuditLogs(request, env, auth.customerId);
        return await wrapWithEncryption(handlerResponse, auth, request, env);
    }
    
    // Configuration endpoints
    if (path === '/admin/config' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetConfig, request, env, auth);
    }
    
    if (path === '/admin/config' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute(adminHandlers.handleUpdateConfig, request, env, auth);
    }
    
    if (path === '/admin/config/email' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute(adminHandlers.handleUpdateEmailConfig, request, env, auth);
    }
    
    // API key management endpoints
    const customerApiKeysMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys$/);
    if (customerApiKeysMatch) {
        const pathCustomerId = customerApiKeysMatch[1];
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        
        if (auth.customerId !== pathCustomerId) {
            return { response: new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        
        if (request.method === 'GET') {
            // Pass JWT token for double-encryption
            const jwtToken = 'jwtToken' in auth ? auth.jwtToken : null;
            return { response: await adminHandlers.handleListApiKeys(request, env, auth.customerId, jwtToken), customerId: auth.customerId };
        }
        if (request.method === 'POST') {
            return { response: await adminHandlers.handleCreateApiKey(request, env, auth.customerId), customerId: auth.customerId };
        }
    }
    
    const revokeApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)$/);
    if (revokeApiKeyMatch && request.method === 'DELETE') {
        const pathCustomerId = revokeApiKeyMatch[1];
        const keyId = revokeApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        
        if (auth.customerId !== pathCustomerId) {
            return { response: new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        
        return { response: await adminHandlers.handleRevokeApiKey(request, env, auth.customerId, keyId), customerId: auth.customerId };
    }
    
    const revealApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/reveal$/);
    if (revealApiKeyMatch && request.method === 'POST') {
        const pathCustomerId = revealApiKeyMatch[1];
        const keyId = revealApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        
        if (auth.customerId !== pathCustomerId) {
            return { response: new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        
        // Require JWT token for reveal endpoint
        if (!('jwtToken' in auth) || !auth.jwtToken) {
            return { response: new Response(JSON.stringify({ 
                error: 'JWT token required',
                message: 'You must be authenticated with a JWT token to reveal API keys'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        
        return { response: await adminHandlers.handleRevealApiKey(request, env, auth.customerId, keyId, auth.jwtToken), customerId: auth.customerId };
    }
    
    const rotateApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/rotate$/);
    if (rotateApiKeyMatch && request.method === 'POST') {
        const pathCustomerId = rotateApiKeyMatch[1];
        const keyId = rotateApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        
        if (auth.customerId !== pathCustomerId) {
            return { response: new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        
        return { response: await adminHandlers.handleRotateApiKey(request, env, auth.customerId, keyId), customerId: auth.customerId };
    }
    
    // Customer status management endpoints
    const suspendCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/suspend$/);
    if (suspendCustomerMatch && request.method === 'POST') {
        const pathCustomerId = suspendCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        return { response: await adminHandlers.handleSuspendCustomer(request, env, pathCustomerId), customerId: auth.customerId };
    }
    
    const activateCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/activate$/);
    if (activateCustomerMatch && request.method === 'POST') {
        const pathCustomerId = activateCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        return { response: await adminHandlers.handleActivateCustomer(request, env, pathCustomerId), customerId: auth.customerId };
    }
    
    const updateStatusMatch = path.match(/^\/admin\/customers\/([^\/]+)\/status$/);
    if (updateStatusMatch && request.method === 'PUT') {
        const pathCustomerId = updateStatusMatch[1];
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return { response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: null };
        }
        const body = await request.json() as { status?: string };
        const { status } = body;
        if (!status) {
            return { response: new Response(JSON.stringify({ error: 'Status required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        return { response: await adminHandlers.handleUpdateCustomerStatus(request, env, pathCustomerId, status), customerId: auth.customerId };
    }
    
    // Super-admin only: Clear rate limit endpoint
    if (path === '/admin/debug/clear-rate-limit' && request.method === 'POST') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        // Super-admin authenticated, allow rate limit clearing
        return { response: await debugHandlers.handleClearRateLimit(request, env, null), customerId: null };
    }
    
    // Data request endpoints (super-admin only)
    if (path === '/admin/data-requests' && request.method === 'POST') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleCreateDataRequest(request, env), customerId: null };
    }
    
    if (path === '/admin/data-requests' && request.method === 'GET') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleListDataRequests(request, env), customerId: null };
    }
    
    const dataRequestMatch = path.match(/^\/admin\/data-requests\/([^\/]+)$/);
    if (dataRequestMatch && request.method === 'GET') {
        const requestId = dataRequestMatch[1];
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleGetDataRequest(request, env, requestId), customerId: null };
    }
    
    return null; // Route not matched
}

