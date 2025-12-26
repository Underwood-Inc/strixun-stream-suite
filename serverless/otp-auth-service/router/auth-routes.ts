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
import { handleRequestOTP } from '../handlers/auth/request-otp.js';
import { handleVerifyOTP } from '../handlers/auth/verify-otp.js';
import { handleSessionByIP } from '../handlers/auth/session-by-ip.js';
import { handleRestoreSession } from '../handlers/auth/restore-session.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface ApiKeyAuth {
    customerId: string;
    keyId: string;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Authenticate request using API key
 */
async function authenticateRequest(request: Request, env: Env): Promise<ApiKeyAuth | null> {
    const authHeader = request.headers.get('Authorization');
    let apiKey: string | null = null;
    
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
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleAuthRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // Authentication endpoints (require API key for multi-tenant)
    // For backward compatibility, allow requests without API key (customerId will be null)
    let customerId: string | null = null;
    let customer = null;
    const auth = await authenticateRequest(request, env);
    
    if (auth) {
        customerId = auth.customerId;
        customer = await getCustomerCached(customerId, (id) => getCustomer(id, env));
        
        // Check IP allowlist (CF-Connecting-IP is set by Cloudflare and cannot be spoofed)
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const ipAllowed = await checkIPAllowlist(customerId, clientIP, env);
        
        if (!ipAllowed) {
            await logSecurityEvent(customerId, 'ip_blocked', {
                ip: clientIP,
                endpoint: path,
                method: request.method
            }, env);
            
            return { 
                response: new Response(JSON.stringify({ error: 'IP address not allowed' }), {
                    status: 403,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId 
            };
        }
        
        // Log API key authentication
        await logSecurityEvent(customerId, 'api_key_auth', {
            keyId: auth.keyId,
            endpoint: path,
            method: request.method,
            ip: clientIP
        }, env);
    } else if (path.startsWith('/auth/') || path.startsWith('/admin/')) {
        // Log failed authentication attempt (CF-Connecting-IP is set by Cloudflare and cannot be spoofed)
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logSecurityEvent(null, 'auth_failed', {
            endpoint: path,
            method: request.method,
            ip: clientIP
        }, env);
    }
    
    // Attach customerId to request context by wrapping handlers
    if (path === '/auth/request-otp' && request.method === 'POST') {
        return { response: await handleRequestOTP(request, env, customerId), customerId };
    }
    if (path === '/auth/verify-otp' && request.method === 'POST') {
        return { response: await handleVerifyOTP(request, env, customerId), customerId };
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
    if (path === '/auth/session-by-ip' && request.method === 'GET') {
        return { response: await handleSessionByIP(request, env), customerId };
    }
    if (path === '/auth/restore-session' && request.method === 'POST') {
        // restore-session doesn't require API key authentication (it's for unauthenticated session restoration)
        return { response: await handleRestoreSession(request, env), customerId: null };
    }
    
    return null; // Route not matched
}

