/**
 * Admin Routes
 * Handles admin endpoints (require API key or JWT token authentication)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyApiKey } from '../services/api-key.js';
import { verifyJWT, getJWTSecret, hashEmail } from '../utils/crypto.js';
import { getCustomerKey } from '../services/customer.js';
import * as adminHandlers from '../handlers/admin.js';
import * as domainHandlers from '../handlers/domain.js';

/**
 * Authenticate request using API key or JWT token
 * Supports both authentication methods for backward compatibility and dashboard access
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
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
    
    // First, try API key verification (for backward compatibility)
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
        
        // Verify customer exists and is active
        if (!customerId) {
            return null; // JWT must have customerId for admin endpoints
        }
        
        // Return auth object in same format as API key auth
        return {
            customerId: customerId,
            // JWT auth doesn't have keyId, but that's okay for admin endpoints
        };
    } catch (error) {
        // JWT verification failed
        return null;
    }
}

/**
 * Helper to wrap admin route handlers with customerId tracking
 */
async function handleAdminRoute(handler, request, env, auth) {
    if (!auth) {
        return { 
            response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), 
            customerId: null 
        };
    }
    return { response: await handler(request, env, auth.customerId), customerId: auth.customerId };
}

/**
 * Handle admin routes
 * @param {Request} request - HTTP request
 * @param {string} path - Request path
 * @param {*} env - Worker environment
 * @returns {Promise<{response: Response, customerId: string|null}>|null} Response and customerId if route matched, null otherwise
 */
export async function handleAdminRoutes(request, path, env) {
    // Customer admin endpoints (require API key auth)
    if (path === '/admin/customers/me' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleAdminGetMe, request, env, auth);
    }
    
    if (path === '/admin/customers/me' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleUpdateMe, request, env, auth);
    }
    
    // Domain verification endpoints (require API key auth)
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
        return handleAdminRoute((req, e, cid) => domainHandlers.handleVerifyDomain(req, e, cid, domain), request, env, auth);
    }
    
    // Analytics endpoints (require API key auth)
    if (path === '/admin/analytics' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetAnalytics, request, env, auth);
    }
    
    if (path === '/admin/analytics/realtime' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetRealtimeAnalytics, request, env, auth);
    }
    
    if (path === '/admin/analytics/errors' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetErrorAnalytics, request, env, auth);
    }
    
    // Onboarding endpoints (require API key auth)
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
        return handleAdminRoute(adminHandlers.handleTestOTP, request, env, auth);
    }
    
    // GDPR endpoints (require API key auth)
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
        return handleAdminRoute((req, e, cid) => adminHandlers.handleDeleteUserData(req, e, cid, userId), request, env, auth);
    }
    
    // Audit logs endpoint (require API key auth)
    if (path === '/admin/audit-logs' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetAuditLogs, request, env, auth);
    }
    
    // Configuration endpoints (require API key auth)
    if (path === '/admin/config' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetConfig, request, env, auth);
    }
    
    if (path === '/admin/config' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleUpdateConfig, request, env, auth);
    }
    
    if (path === '/admin/config/email' && request.method === 'PUT') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleUpdateEmailConfig, request, env, auth);
    }
    
    // API key management endpoints (require API key auth)
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
            return { response: await adminHandlers.handleListApiKeys(request, env, auth.customerId), customerId: auth.customerId };
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
    
    // Customer status management endpoints (require API key auth)
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
        const body = await request.json();
        const { status } = body;
        if (!status) {
            return { response: new Response(JSON.stringify({ error: 'Status required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId: auth.customerId };
        }
        return { response: await adminHandlers.handleUpdateCustomerStatus(request, env, pathCustomerId, status), customerId: auth.customerId };
    }
    
    return null; // Route not matched
}

