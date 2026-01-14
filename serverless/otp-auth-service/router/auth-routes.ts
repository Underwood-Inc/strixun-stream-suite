/**
 * Auth Routes
 * Handles authentication endpoints (may require API key for multi-tenant)
 */

import { getCorsHeaders } from '../utils/cors.js';
// getCorsHeaders is already imported above
import { getCustomerCached } from '../utils/cache.js';
import { getCustomer } from '../services/customer.js';
import { verifyApiKey } from '../services/api-key.js';
import { checkIPAllowlist, logSecurityEvent } from '../services/security.js';
import * as authHandlers from '../handlers/auth.js';
import { handleRequestOTP } from '../handlers/auth/request-otp.js';
import { handleVerifyOTP } from '../handlers/auth/verify-otp.js';
// CRITICAL: user-lookup removed - we ONLY use customerId, NO userId
// CRITICAL: wrapWithEncryption removed - main router handles ALL encryption (avoids double-encryption)

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
 * PURPOSE: Multi-tenant identification (subscription tiers, rate limiting, entity separation)
 * NOT for security - JWT handles authentication/encryption
 * Checks X-OTP-API-Key header first, then Authorization header
 * This allows JWT in Authorization header and API key in X-OTP-API-Key header
 */
async function authenticateRequest(request: Request, env: Env): Promise<ApiKeyAuth | null> {
    // CRITICAL: API keys MUST be in X-OTP-API-Key header ONLY
    // Authorization header is for JWT tokens ONLY
    // This separation ensures clear distinction between authentication (JWT) and identification (API key)
    const rawApiKey = request.headers.get('X-OTP-API-Key');
    if (!rawApiKey) {
        return null;
    }
    
    const apiKey = rawApiKey.trim();
    
    // Validate API key format
    // API keys start with 'otp_live_sk_' or 'otp_test_sk_'
    if (!apiKey.startsWith('otp_live_sk_') && !apiKey.startsWith('otp_test_sk_')) {
        // Not an API key format - return null
        console.log(`[AuthRoutes] Invalid API key format in X-OTP-API-Key header: ${apiKey.substring(0, 20)}...`);
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
 * Authenticate request using JWT token with SSO scope validation
 * @param request - HTTP request
 * @param env - Worker environment
 * @param requestingKeyId - API key ID from request (optional, for SSO validation)
 * @returns JWT payload with customerId or null
 */
async function authenticateJWT(
    request: Request,
    env: Env,
    requestingKeyId?: string
): Promise<{ customerId: string; payload: any } | null> {
    // CRITICAL: Check HttpOnly cookie FIRST, then Authorization header
    let token: string | null = null;
    
    // Check cookie first (primary - HttpOnly SSO)
    const cookieHeader = request.headers.get('Cookie');
    console.log('[AuthRoutes] authenticateJWT - Cookie header:', cookieHeader ? 'present' : 'missing');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
            console.log('[AuthRoutes] authenticateJWT - Token extracted from cookie:', token ? token.substring(0, 20) + '...' : 'empty');
        }
    }
    
    if (!token) {
        return null;
    }
    
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
        
        // INTER-TENANT SSO VALIDATION
        // Validate that the requesting API key has permission to use this session
        // This enables customers to control which of their API keys can share sessions
        if (payload.ssoScope && requestingKeyId) {
            const { validateSSOAccess } = await import('../services/api-key-management.js');
            const hasAccess = validateSSOAccess(
                requestingKeyId,
                payload.ssoScope,
                payload.customerId
            );
            
            if (!hasAccess) {
                console.log('[AuthRoutes] SSO access denied:', {
                    requestingKeyId,
                    sessionKeyId: payload.keyId,
                    ssoScope: payload.ssoScope,
                    customerId: payload.customerId
                });
                return null; // SSO access denied
            }
            
            console.log('[AuthRoutes] SSO access granted:', {
                requestingKeyId,
                sessionKeyId: payload.keyId,
                ssoScope: payload.ssoScope
            });
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
    
    // Step 1: Check API key first (to get keyId for SSO validation)
    // API keys are for multi-tenant identification, not authentication
    const AUTH_ENDPOINTS_NO_JWT = ['/auth/request-otp', '/auth/verify-otp'];
    const isAuthEndpointNoJWT = AUTH_ENDPOINTS_NO_JWT.includes(path);
    
    if (!isAuthEndpointNoJWT) {
        apiKeyAuth = await authenticateRequest(request, env);
    }
    
    // Step 2: Try JWT authentication with SSO validation
    // Pass the API key ID (if present) for inter-tenant SSO validation
    jwtAuth = await authenticateJWT(request, env, apiKeyAuth?.keyId);
    if (jwtAuth) {
        customerId = jwtAuth.customerId;
        console.log(`[AuthRoutes] JWT authentication successful:`, {
            customerId: jwtAuth.customerId,
            keyId: apiKeyAuth?.keyId,
            path
        });
    }
    
    // Step 3: Validate API key and JWT consistency
    // CRITICAL: API keys MUST be in X-OTP-API-Key header ONLY
    // Authorization header is for JWT tokens ONLY
    const apiKeyHeader = request.headers.get('X-OTP-API-Key');
    const hasApiKeyInHeader = !!apiKeyHeader;
    
    // If API key is provided but invalid, reject request
    if (!isAuthEndpointNoJWT && hasApiKeyInHeader && !apiKeyAuth) {
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
    
    // If both JWT and API key are provided, validate they match the same customer entity
    // This ensures the authenticated user (JWT) belongs to the identified entity (API key)
    if (jwtAuth && apiKeyAuth && jwtAuth.customerId !== apiKeyAuth.customerId) {
        console.log(`[AuthRoutes] Customer mismatch: JWT and API key must belong to the same customer entity`, {
            jwtCustomerId: jwtAuth.customerId,
            apiKeyCustomerId: apiKeyAuth.customerId
        });
        return {
            response: new Response(JSON.stringify({ error: 'Customer mismatch: JWT and API key must belong to the same customer entity' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }
    
    // For auth endpoints that don't require JWT, API key handling is already done above
    // SECURITY: If API key is provided, use it to get customerId for origin validation
    // This ensures origin validation runs even when no JWT is present
    if (apiKeyAuth && !customerId) {
        customerId = apiKeyAuth.customerId;
    }
    
    // Get customer for origin validation and CORS headers (needed when API key is used)
    if (customerId) {
        customer = await getCustomerCached(customerId, (id) => getCustomer(id, env));
        
        // SECURITY: Validate origin when API key is used (prevents API key abuse from unauthorized origins)
        // This is critical because API keys can be stolen and used from any origin if not validated
        // CORS headers alone don't prevent server-side requests - we need explicit origin validation
        // NOTE: API key is ONLY for CORS bypass - NOTHING CHANGES in application logic
        if (apiKeyAuth) {
            const requestOrigin = request.headers.get('Origin');
            const allowedOrigins = customer?.config?.allowedOrigins || [];
            
            // SECURITY: If allowedOrigins is configured, validate origin
            // If allowedOrigins is empty, reject browser requests (Origin header present)
            // Server-to-server requests (no Origin header) are allowed when allowedOrigins is empty
            if (requestOrigin) {
                // Browser request - must validate origin
                if (allowedOrigins.length === 0) {
                    // SECURITY: No origins configured - reject browser requests
                    // Customer must configure allowedOrigins before using API key from browser
                    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
                    await logSecurityEvent(customerId, 'origin_blocked_no_config', {
                        origin: requestOrigin,
                        endpoint: path,
                        method: request.method,
                        ip: clientIP,
                        keyId: apiKeyAuth.keyId,
                        reason: 'No allowedOrigins configured - customer must configure allowedOrigins before using API key from browser'
                    }, env);
                    
                    return {
                        response: new Response(JSON.stringify({ 
                            error: 'Origin validation required',
                            detail: 'This API key requires allowedOrigins to be configured. Please configure allowedOrigins in your customer settings before using this API key from a browser.'
                        }), {
                            status: 403,
                            headers: { 
                                ...getCorsHeaders(env, request, customer), 
                                'Content-Type': 'application/json' 
                            },
                        }),
                        customerId
                    };
                }
                
                // Validate origin against allowedOrigins
                const isOriginAllowed = allowedOrigins.includes('*') || 
                    allowedOrigins.some(allowed => {
                        if (allowed === '*') return true;
                        if (allowed === requestOrigin) return true;
                        // Support wildcard patterns like "https://*.example.com"
                        if (allowed.endsWith('*')) {
                            const prefix = allowed.slice(0, -1);
                            return requestOrigin.startsWith(prefix);
                        }
                        return false;
                    });
                
                if (!isOriginAllowed) {
                    // SECURITY: Reject request if origin doesn't match allowed origins
                    // This prevents API key abuse from unauthorized origins
                    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
                    await logSecurityEvent(customerId, 'origin_blocked', {
                        origin: requestOrigin,
                        allowedOrigins: allowedOrigins,
                        endpoint: path,
                        method: request.method,
                        ip: clientIP,
                        keyId: apiKeyAuth.keyId
                    }, env);
                    
                    return {
                        response: new Response(JSON.stringify({ 
                            error: 'Origin not allowed',
                            detail: 'This API key is not authorized for requests from this origin'
                        }), {
                            status: 403,
                            headers: { 
                                ...getCorsHeaders(env, request, customer), 
                                'Content-Type': 'application/json' 
                            },
                        }),
                        customerId
                    };
                }
            }
            // If no Origin header (server-to-server request), allow regardless of allowedOrigins configuration
            // This allows backend services to use API keys without Origin restrictions
        }
        
        // Check IP allowlist (CF-Connecting-IP is set by Cloudflare and cannot be spoofed)
        // Note: IP allowlist is separate from origin validation - both are security layers
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
                    headers: { ...getCorsHeaders(env, request, customer), 'Content-Type': 'application/json' },
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
    // CRITICAL: Check HttpOnly cookie FIRST, then Authorization header
    let jwtToken: string | null = null;
    
    // Check cookie first (primary - HttpOnly SSO)
    const cookieHeader = request.headers.get('Cookie');
    console.log('[AuthRoutes] JWT extraction for encryption - Cookie header:', cookieHeader ? 'present' : 'missing', 'path:', path);
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (authCookie) {
            jwtToken = authCookie.substring('auth_token='.length).trim();
            console.log('[AuthRoutes] JWT extraction for encryption - Token from cookie:', jwtToken ? jwtToken.substring(0, 20) + '...' : 'empty');
        } else {
            console.log('[AuthRoutes] JWT extraction for encryption - No auth_token cookie found');
        }
    } else {
        console.log('[AuthRoutes] JWT extraction for encryption - No cookie header, NO FALLBACKS');
    }
    
    // Check if the token is actually a JWT (not an API key)
    const isJWT = jwtToken && !jwtToken.startsWith('otp_live_sk_') && !jwtToken.startsWith('otp_test_sk_');
    console.log('[AuthRoutes] JWT extraction for encryption - isJWT:', isJWT, 'jwtAuth present:', !!jwtAuth);
    
    // Build auth object for encryption wrapper
    // CRITICAL: JWT is ALWAYS required for encryption (security requirement)
    // If JWT is not present or invalid, encryption will fail (as it should)
    const authForEncryption = (jwtToken && isJWT && jwtAuth)
        ? { userId: 'anonymous', customerId: jwtAuth.customerId, jwtToken } 
        : null;
    
    console.log('[AuthRoutes] authForEncryption built:', authForEncryption ? 'YES (has token)' : 'NO (null)', 'for path:', path);
    
    // Attach customerId to request context by wrapping handlers
    // Note: AUTH_ENDPOINTS_NO_JWT and isAuthEndpointNoJWT are already declared above (lines 162-163)
    if (path === '/auth/request-otp' && request.method === 'POST') {
        // THIRD-PARTY DEVELOPER INTEGRATION: API key provides CORS bypass for allowed origins
        // - API key is OPTIONAL and ONLY provides CORS bypass and multi-tenant features
        // - JWT is STILL REQUIRED for authentication (if provided)
        // - Customer.config.allowedOrigins is used to validate origin and bypass CORS
        // - API key does NOT replace JWT - it's additional functionality
        const handlerResponse = await handleRequestOTP(request, env, customerId);
        
        // Apply CORS headers based on customer's allowedOrigins (API key-based origin bypass)
        // This allows third-party developers to configure which origins can call their API
        // NOTE: This is ONLY for CORS - JWT is still required for authentication
        const corsHeaders = getCorsHeaders(env, request, customer);
        const responseWithCors = new Response(handlerResponse.body, {
            status: handlerResponse.status,
            statusText: handlerResponse.statusText,
            headers: {
                ...Object.fromEntries(handlerResponse.headers.entries()),
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: responseWithCors, customerId };
    }
    if (path === '/auth/verify-otp' && request.method === 'POST') {
        // API key is OPTIONAL and ONLY provides CORS bypass for allowed origins
        // NOTHING CHANGES in application logic - JWT requirements are UNCHANGED
        // API key is purely additive functionality for CORS bypass only
        const handlerResponse = await handleVerifyOTP(request, env, customerId);
        
        // Apply CORS headers based on customer's allowedOrigins (if API key provided)
        // This is the ONLY thing API key does - provides CORS bypass for allowed origins
        const corsHeaders = getCorsHeaders(env, request, customer);
        const responseWithCors = new Response(handlerResponse.body, {
            status: handlerResponse.status,
            statusText: handlerResponse.statusText,
            headers: {
                ...Object.fromEntries(handlerResponse.headers.entries()),
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: responseWithCors, customerId };
    }
    if (path === '/auth/me' && request.method === 'GET') {
        console.log('[AuthRoutes] /auth/me - Calling handleGetMe');
        const handlerResponse = await authHandlers.handleGetMe(request, env);
        console.log('[AuthRoutes] /auth/me - handleGetMe returned status:', handlerResponse.status);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId };
    }
    if (path === '/auth/encryption/dek' && request.method === 'GET') {
        if (!jwtAuth || !jwtAuth.customerId) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }),
                customerId: null,
            };
        }
        const handlerResponse = await authHandlers.handleGetEncryptionDek(request, env, jwtAuth.customerId);
        return { response: handlerResponse, customerId: jwtAuth.customerId };
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
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId: customerIdToPass };
    }
    if (path === '/auth/logout' && request.method === 'POST') {
        const handlerResponse = await authHandlers.handleLogout(request, env);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId };
    }
    if (path === '/auth/refresh' && request.method === 'POST') {
        const handlerResponse = await authHandlers.handleRefresh(request, env);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId };
    }
    
    // CRITICAL: User lookup endpoint removed - we ONLY use customerId, NO userId
    // The only lookup is email -> customerId for OTP to work
    
    return null; // Route not matched
}

