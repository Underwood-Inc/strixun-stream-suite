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
 * SECURITY: Checks X-OTP-API-Key header first, then Authorization header
 * This allows JWT in Authorization header and API key in X-OTP-API-Key header
 */
async function authenticateRequest(request: Request, env: Env): Promise<ApiKeyAuth | null> {
    let apiKey: string | null = null;
    
    // CRITICAL: Check X-OTP-API-Key header FIRST (allows JWT in Authorization header)
    const rawApiKey = request.headers.get('X-OTP-API-Key');
    if (rawApiKey) {
        apiKey = rawApiKey.trim();
    } else {
        // Fallback: Check Authorization header if X-OTP-API-Key not present
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // CRITICAL: Trim token to ensure it matches the token used for encryption
            apiKey = authHeader.substring(7).trim();
        }
    }
    
    if (!apiKey) {
        return null;
    }
    
    // Only attempt API key verification if the value looks like an API key
    // API keys start with 'otp_live_sk_' or 'otp_test_sk_'
    // If it doesn't match this pattern, it's likely a JWT token, so don't try API key verification
    const isApiKeyFormat = apiKey.startsWith('otp_live_sk_') || apiKey.startsWith('otp_test_sk_');
    
    if (!isApiKeyFormat) {
        // Not an API key format - likely a JWT token, so return null to allow JWT verification
        return null;
    }
    
    // Attempt to verify as API key
    const authResult = await verifyApiKey(apiKey, env);
    
    if (authResult) {
        console.log(`[AuthRoutes] API key authentication successful:`, {
            customerId: authResult.customerId,
            keyId: authResult.keyId,
            apiKeyPrefix: apiKey.substring(0, 20) + '...'
        });
    } else {
        console.log(`[AuthRoutes] API key verification failed:`, {
            apiKeyPrefix: apiKey.substring(0, 20) + '...',
            reason: 'Key not found in KV or inactive'
        });
    }
    
    return authResult;
}

/**
 * Authenticate request using JWT token
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns JWT payload with customerId or null
 */
async function authenticateJWT(request: Request, env: Env): Promise<{ customerId: string; payload: any } | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authHeader.substring(7).trim();
    
    // Check if it's an API key format - if so, don't try JWT verification
    if (token.startsWith('otp_live_sk_') || token.startsWith('otp_test_sk_')) {
        return null; // This is an API key, not a JWT
    }
    
    try {
        const { verifyJWT, getJWTSecret } = await import('../utils/crypto.js');
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload || !payload.customerId) {
            return null;
        }
        
        return {
            customerId: payload.customerId,
            payload
        };
    } catch (error) {
        console.log(`[AuthRoutes] JWT verification failed:`, error instanceof Error ? error.message : String(error));
        return null;
    }
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
    // SECURITY: JWT authentication comes FIRST
    // API key is NOT a fallback - JWT is ALWAYS required for encryption (no compromising security)
    // If JWT fails, request fails - we do NOT fall back to API key
    
    let customerId: string | null = null;
    let customer = null;
    let apiKeyAuth: ApiKeyAuth | null = null;
    let jwtAuth: { customerId: string; payload: any } | null = null;
    
    // Step 1: Try JWT authentication first
    jwtAuth = await authenticateJWT(request, env);
    if (jwtAuth) {
        customerId = jwtAuth.customerId;
        console.log(`[AuthRoutes] JWT authentication successful:`, {
            customerId: jwtAuth.customerId,
            path
        });
    }
    
    // Step 2: Also check API key (but JWT is still required for encryption)
    // API key can be used for additional authorization checks, but JWT is primary
    // If API key is provided, it MUST be valid (not revoked/inactive)
    // EXCEPTION: Auth endpoints that don't require JWT (/auth/request-otp, etc.) don't require API key validation
    const AUTH_ENDPOINTS_NO_JWT = ['/auth/request-otp', '/auth/verify-otp', '/auth/restore-session'];
    const isAuthEndpointNoJWT = AUTH_ENDPOINTS_NO_JWT.includes(path);
    
    const apiKeyHeader = request.headers.get('X-OTP-API-Key');
    const authHeaderForApiKey = request.headers.get('Authorization');
    const hasApiKeyInHeader = apiKeyHeader || (authHeaderForApiKey && authHeaderForApiKey.startsWith('Bearer ') && 
        (authHeaderForApiKey.substring(7).trim().startsWith('otp_live_sk_') || authHeaderForApiKey.substring(7).trim().startsWith('otp_test_sk_')));
    
    // Only validate API key for endpoints that require JWT (security requirement)
    // Auth endpoints that don't require JWT are public and don't need API key validation
    if (!isAuthEndpointNoJWT) {
        apiKeyAuth = await authenticateRequest(request, env);
        if (hasApiKeyInHeader && !apiKeyAuth) {
            // API key was provided but is invalid/revoked - reject request
            console.log(`[AuthRoutes] API key provided but invalid or revoked`);
            return {
                response: new Response(JSON.stringify({ error: 'Invalid or revoked API key' }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }
    } else {
        // For auth endpoints that don't require JWT, still check API key but don't require it
        apiKeyAuth = await authenticateRequest(request, env);
    }
    if (apiKeyAuth) {
        // If we have JWT auth, verify API key matches same customer (additional security check)
        if (jwtAuth && jwtAuth.customerId !== apiKeyAuth.customerId) {
            console.log(`[AuthRoutes] Security violation: JWT and API key customer mismatch`, {
                jwtCustomerId: jwtAuth.customerId,
                apiKeyCustomerId: apiKeyAuth.customerId
            });
            return {
                response: new Response(JSON.stringify({ error: 'Authentication mismatch: JWT and API key must belong to the same customer' }), {
                    status: 403,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }
        // If no JWT but API key exists, we still need JWT for encryption (will fail later)
        if (!jwtAuth) {
            console.log(`[AuthRoutes] API key provided but JWT required for encryption`);
        }
    }
    
    if (customerId) {
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
        
        // Log authentication
        if (apiKeyAuth) {
            await logSecurityEvent(customerId, 'api_key_auth', {
                keyId: apiKeyAuth.keyId,
                endpoint: path,
                method: request.method,
                ip: clientIP
            }, env);
        } else if (jwtAuth) {
            await logSecurityEvent(customerId, 'jwt_auth', {
                endpoint: path,
                method: request.method,
                ip: clientIP
            }, env);
        }
    } else if (path.startsWith('/auth/') || path.startsWith('/admin/')) {
        // Log failed authentication attempt (CF-Connecting-IP is set by Cloudflare and cannot be spoofed)
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        await logSecurityEvent(null, 'auth_failed', {
            endpoint: path,
            method: request.method,
            ip: clientIP
        }, env);
    }
    
    // Extract JWT token for encryption (CRITICAL: JWT is ALWAYS required for encryption)
    // API key authentication does NOT replace JWT - JWT is mandatory for encryption
    const authHeader = request.headers.get('Authorization');
    const rawJwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const jwtToken = rawJwtToken ? rawJwtToken.trim() : null;
    
    // Check if the token is actually a JWT (not an API key)
    const isJWT = jwtToken && !jwtToken.startsWith('otp_live_sk_') && !jwtToken.startsWith('otp_test_sk_');
    
    if (path === '/auth/me' && jwtToken && isJWT) {
        console.log('[AuthRoutes] /auth/me - Token extraction for encryption:', {
            rawTokenLength: rawJwtToken?.length || 0,
            trimmedTokenLength: jwtToken?.length || 0,
            rawTokenPrefix: rawJwtToken ? rawJwtToken.substring(0, 20) + '...' : 'none',
            trimmedTokenPrefix: jwtToken ? jwtToken.substring(0, 20) + '...' : 'none',
        });
    }
    
    // Build auth object for encryption wrapper
    // CRITICAL: JWT is ALWAYS required for encryption (security requirement)
    // If JWT is not present or invalid, encryption will fail (as it should)
    const authForEncryption = (jwtToken && isJWT && jwtAuth)
        ? { userId: 'anonymous', customerId: jwtAuth.customerId, jwtToken } 
        : null;
    
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
        // Pass customerId from JWT auth (primary) - API key is NOT a fallback
        // CRITICAL: JWT is ALWAYS required for encryption (security requirement)
        // If JWT auth failed, customerId will be null and request will fail (as it should)
        const customerIdToPass = jwtAuth ? jwtAuth.customerId : null;
        console.log(`[AuthRoutes] /auth/quota - Authentication details:`, {
            hasJwtAuth: !!jwtAuth,
            hasApiKeyAuth: !!apiKeyAuth,
            customerId: customerIdToPass,
            hasJwtToken: !!(jwtToken && isJWT),
            authHeader: request.headers.get('Authorization') ? request.headers.get('Authorization')?.substring(0, 30) + '...' : null,
            xApiKeyHeader: request.headers.get('X-OTP-API-Key') ? request.headers.get('X-OTP-API-Key')?.substring(0, 30) + '...' : null
        });
        const handlerResponse = await authHandlers.handleGetQuota(request, env, customerIdToPass);
        const encryptedResult = await wrapWithEncryption(
            handlerResponse,
            authForEncryption,
            request,
            env
            // CRITICAL: No requireJWT: false - JWT is ALWAYS required for encryption
            // If JWT is missing or invalid, encryption will fail (security requirement)
        );
        return { response: encryptedResult.response, customerId: customerIdToPass };
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

