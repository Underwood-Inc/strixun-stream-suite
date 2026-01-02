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
import { handleUserLookup } from '../handlers/auth/user-lookup.js';
import { wrapWithEncryption } from '@strixun/api-framework';

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
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        apiKey = authHeader.substring(7).trim();
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
    
    // Extract JWT token for encryption (if present)
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const authHeader = request.headers.get('Authorization');
    const rawJwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const jwtToken = rawJwtToken ? rawJwtToken.trim() : null;
    const wasTrimmed = rawJwtToken && rawJwtToken !== jwtToken;
    
    if (path === '/auth/me' && jwtToken) {
        console.log('[AuthRoutes] /auth/me - Token extraction for encryption:', {
            rawTokenLength: rawJwtToken?.length || 0,
            trimmedTokenLength: jwtToken?.length || 0,
            wasTrimmed,
            rawTokenPrefix: rawJwtToken ? rawJwtToken.substring(0, 20) + '...' : 'none',
            trimmedTokenPrefix: jwtToken ? jwtToken.substring(0, 20) + '...' : 'none',
            rawTokenSuffix: rawJwtToken ? '...' + rawJwtToken.substring(rawJwtToken.length - 10) : 'none',
            trimmedTokenSuffix: jwtToken ? '...' + jwtToken.substring(jwtToken.length - 10) : 'none',
            authHeaderPrefix: authHeader ? authHeader.substring(0, 27) + '...' : 'none',
        });
    }
    
    const authForEncryption = jwtToken ? { userId: 'anonymous', customerId, jwtToken } : null;
    
    // Authentication endpoints that generate JWTs - MUST use requireJWT: false
    const AUTH_ENDPOINTS_NO_JWT = ['/auth/request-otp', '/auth/verify-otp', '/auth/restore-session'];
    const isAuthEndpointNoJWT = AUTH_ENDPOINTS_NO_JWT.includes(path);
    
    // Attach customerId to request context by wrapping handlers
    if (path === '/auth/request-otp' && request.method === 'POST') {
        const handlerResponse = await handleRequestOTP(request, env, customerId);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env,
            { 
                requireJWT: false, // ⚠️ Exception - part of auth flow
                allowServiceCallsWithoutJWT: true // ⚠️ CRITICAL - Allow service-to-service calls (OTP is exception to always-encrypted rule)
            }
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/verify-otp' && request.method === 'POST') {
        const handlerResponse = await handleVerifyOTP(request, env, customerId);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env,
            { 
                requireJWT: false, // ⚠️ CRITICAL - Returns JWT token (chicken-and-egg problem)
                allowServiceCallsWithoutJWT: true // ⚠️ CRITICAL - Allow service-to-service calls (OTP is exception to always-encrypted rule)
            }
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/me' && request.method === 'GET') {
        const handlerResponse = await authHandlers.handleGetMe(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/quota' && request.method === 'GET') {
        const handlerResponse = await authHandlers.handleGetQuota(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/logout' && request.method === 'POST') {
        const handlerResponse = await authHandlers.handleLogout(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/refresh' && request.method === 'POST') {
        const handlerResponse = await authHandlers.handleRefresh(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/session-by-ip' && request.method === 'GET') {
        const handlerResponse = await handleSessionByIP(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
        );
        return { response: encryptedResult.response, customerId };
    }
    if (path === '/auth/restore-session' && request.method === 'POST') {
        // restore-session doesn't require API key authentication (it's for unauthenticated session restoration)
        const handlerResponse = await handleRestoreSession(request, env);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env,
            { 
                requireJWT: false, // ⚠️ Exception - may return JWT
                allowServiceCallsWithoutJWT: true // ⚠️ CRITICAL - Allow service-to-service calls (OTP is exception to always-encrypted rule)
            }
        );
        return { response: encryptedResult.response, customerId: null };
    }
    
    // Public user lookup endpoint - GET /auth/user/:userId
    // Returns public user info (displayName) by userId for service-to-service communication
    const userLookupMatch = path.match(/^\/auth\/user\/([^\/]+)$/);
    if (userLookupMatch && request.method === 'GET') {
        const userId = userLookupMatch[1];
        // This is a public endpoint - no authentication required
        return { response: await handleUserLookup(request, env, userId), customerId: null };
    }
    
    return null; // Route not matched
}

