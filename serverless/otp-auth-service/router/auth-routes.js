/**
 * Auth Routes
 * Handles authentication endpoints (may require API key for multi-tenant)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { getCustomerCached } from '../utils/cache.js';
import { getCustomer } from '../services/customer.js';
import { verifyApiKey } from '../services/api-key.js';
import { checkIPAllowlist, logSecurityEvent } from '../services/security.js';
import * as authHandlers from '../handlers/auth.js';

/**
 * Authenticate request using API key
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    let apiKey = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
    } else {
        apiKey = request.headers.get('X-OTP-API-Key');
    }
    
    if (!apiKey) {
        return null;
    }
    
    return await verifyApiKey(apiKey, env);
}

/**
 * Handle auth routes
 * @param {Request} request - HTTP request
 * @param {string} path - Request path
 * @param {*} env - Worker environment
 * @returns {Promise<{response: Response, customerId: string|null}>|null} Response and customerId if route matched, null otherwise
 */
export async function handleAuthRoutes(request, path, env) {
    // Authentication endpoints (require API key for multi-tenant)
    // For backward compatibility, allow requests without API key (customerId will be null)
    let customerId = null;
    let customer = null;
    const auth = await authenticateRequest(request, env);
    
    if (auth) {
        customerId = auth.customerId;
        customer = await getCustomerCached(customerId, (id) => getCustomer(id, env));
        
        // Check IP allowlist
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        const ipAllowed = await checkIPAllowlist(customerId, clientIP, env);
        
        if (!ipAllowed) {
            await logSecurityEvent(customerId, 'ip_blocked', {
                ip: clientIP,
                endpoint: path,
                method: request.method
            }, env);
            
            return { response: new Response(JSON.stringify({ error: 'IP address not allowed' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }), customerId };
        }
        
        // Log API key authentication
        await logSecurityEvent(customerId, 'api_key_auth', {
            keyId: auth.keyId,
            endpoint: path,
            method: request.method,
            ip: clientIP
        }, env);
    } else if (path.startsWith('/auth/') || path.startsWith('/admin/')) {
        // Log failed authentication attempt
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        await logSecurityEvent(null, 'auth_failed', {
            endpoint: path,
            method: request.method,
            ip: clientIP
        }, env);
    }
    
    // Attach customerId to request context by wrapping handlers
    if (path === '/auth/request-otp' && request.method === 'POST') {
        return { response: await authHandlers.handleRequestOTP(request, env, customerId), customerId };
    }
    if (path === '/auth/verify-otp' && request.method === 'POST') {
        return { response: await authHandlers.handleVerifyOTP(request, env, customerId), customerId };
    }
    if (path === '/auth/me' && request.method === 'GET') {
        return { response: await authHandlers.handleGetMe(request, env), customerId };
    }
    if (path === '/auth/quota' && request.method === 'GET') {
        return { response: await authHandlers.handleGetQuota(request, env), customerId };
    }
    if (path === '/auth/logout' && request.method === 'POST') {
        return { response: await authHandlers.handleLogout(request, env), customerId };
    }
    if (path === '/auth/refresh' && request.method === 'POST') {
        return { response: await authHandlers.handleRefresh(request, env), customerId };
    }
    
    return null; // Route not matched
}

