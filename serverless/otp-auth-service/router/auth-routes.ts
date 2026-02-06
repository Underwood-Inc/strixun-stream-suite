/**
 * Auth Routes
 * Handles authentication endpoints (may require API key for multi-tenant)
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../utils/cors.js';
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
    allowedOrigins?: string[];
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
    // CRITICAL: Check HttpOnly cookie FIRST, then Authorization header (for service-to-service SSO)
    let token: string | null = null;
    
    // PRIORITY 1: Check cookie first (primary - HttpOnly SSO for browsers)
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
            console.log('[AuthRoutes] authenticateJWT - Token extracted from cookie:', token ? token.substring(0, 20) + '...' : 'empty');
        }
    }
    
    // PRIORITY 2: Check Authorization header (service-to-service calls)
    if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring('Bearer '.length).trim();
            console.log('[AuthRoutes] authenticateJWT - Token extracted from Authorization header:', token ? token.substring(0, 20) + '...' : 'empty');
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
    
    // Step 1: ALWAYS validate API key if provided
    // SECURITY: If an API key is provided, it MUST be valid - we never ignore invalid keys
    const AUTH_ENDPOINTS_NO_JWT = ['/auth/request-otp', '/auth/verify-otp'];
    const isAuthEndpointNoJWT = AUTH_ENDPOINTS_NO_JWT.includes(path);
    
    // Always attempt to validate API key if the header is present
    const apiKeyHeader = request.headers.get('X-OTP-API-Key');
    if (apiKeyHeader) {
        apiKeyAuth = await authenticateRequest(request, env);
        
        // CRITICAL: If API key was provided but validation failed, REJECT immediately
        // We NEVER allow requests with invalid API keys to proceed
        if (!apiKeyAuth) {
            console.log(`[AuthRoutes] REJECTED: Invalid or revoked API key provided`);
            return {
                response: new Response(JSON.stringify({ error: 'Invalid or revoked API key' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }
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
    // Note: Invalid API key rejection is already handled above in Step 1
    
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
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
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
        
        // MULTI-TENANT CORS: Per-key origin restrictions
        // This enables third-party developers to use API keys from their own domains
        // - API key has allowedOrigins configured → ONLY allow from those specific origins
        // - API key has NO allowedOrigins → allow from ANY origin (key is the auth)
        if (apiKeyAuth) {
            const requestOrigin = request.headers.get('Origin');
            
            // MULTI-TENANCY CORS LOGIC:
            // - If API key has NO origins configured → Allow from ANY origin (API key is the auth)
            // - If API key HAS origins configured → Only allow from those specific origins
            // This gives developers flexibility: simple mode (any origin) or strict mode (specific origins)
            
            let allowedOrigins: string[] = [];
            let originRestrictionEnabled = false;
            
            // Check if API key has its own allowed origins configured
            if (apiKeyAuth.allowedOrigins && apiKeyAuth.allowedOrigins.length > 0) {
                allowedOrigins = apiKeyAuth.allowedOrigins;
                originRestrictionEnabled = true;
                console.log('[AuthRoutes] Per-key origin restriction ENABLED:', {
                    keyId: apiKeyAuth.keyId,
                    originsCount: allowedOrigins.length
                });
            } else {
                console.log('[AuthRoutes] No origin restriction for this key (any origin allowed):', {
                    keyId: apiKeyAuth.keyId,
                    customerId
                });
            }
            
            // If no Origin header (server-to-server request), allow it
            // Server-to-server requests don't have CORS restrictions
            if (!requestOrigin) {
                console.log('[AuthRoutes] No Origin header (server-to-server), allowing request');
            } else if (!originRestrictionEnabled) {
                // API key has NO origins configured - allow from any origin
                // The API key itself is the authentication, origin doesn't matter
                console.log('[AuthRoutes] No origin restriction configured, allowing any origin:', {
                    origin: requestOrigin,
                    keyId: apiKeyAuth.keyId
                });
            } else {
                // API key HAS origins configured - must validate origin
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
                    // Origin not in key's allowed list
                    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
                    await logSecurityEvent(customerId, 'origin_blocked', {
                        origin: requestOrigin,
                        allowedOrigins: allowedOrigins.slice(0, 5), // Log first 5 only
                        endpoint: path,
                        method: request.method,
                        ip: clientIP,
                        keyId: apiKeyAuth.keyId
                    }, env);
                    
                    return {
                        response: new Response(JSON.stringify({ 
                            error: 'Origin not allowed',
                            detail: `Origin "${requestOrigin}" is not in this API key's allowed origins. Add it in the dashboard.`
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
                
                console.log('[AuthRoutes] Origin allowed:', { requestOrigin, keyId: apiKeyAuth.keyId });
            }
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
                    headers: { ...getCorsHeadersRecord(env, request, customer), 'Content-Type': 'application/json' },
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
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (authCookie) {
            jwtToken = authCookie.substring('auth_token='.length).trim();
        }
    }
    
    // Check if the token is actually a JWT (not an API key)
    const isJWT = jwtToken && !jwtToken.startsWith('otp_live_sk_') && !jwtToken.startsWith('otp_test_sk_');

    // Build auth object for encryption wrapper
    // CRITICAL: JWT is ALWAYS required for encryption (security requirement)
    // If JWT is not present or invalid, encryption will fail (as it should)
    const authForEncryption = (jwtToken && isJWT && jwtAuth)
        ? { userId: 'anonymous', customerId: jwtAuth.customerId, jwtToken }
        : null;
    
    // Attach customerId to request context by wrapping handlers
    // Note: AUTH_ENDPOINTS_NO_JWT and isAuthEndpointNoJWT are already declared above (lines 162-163)
    if (path === '/auth/request-otp' && request.method === 'POST') {
        // THIRD-PARTY DEVELOPER INTEGRATION: API key provides CORS bypass for allowed origins
        // - API key is OPTIONAL and provides multi-tenant identification
        // - JWT is STILL REQUIRED for user authentication
        // - Per-key allowedOrigins restricts which origins can use this key (if configured)
        // - API key does NOT replace JWT - it's additional functionality
        const handlerResponse = await handleRequestOTP(request, env, customerId);
        
        // CORS: Use API key's per-key origins (not customer config)
        // Valid API key with origins → use those. Valid key without origins → ['*'] (allow any)
        const corsCustomer = apiKeyAuth 
            ? { config: { allowedOrigins: apiKeyAuth.allowedOrigins?.length ? apiKeyAuth.allowedOrigins : ['*'] } }
            : customer;
        const corsHeaders = getCorsHeaders(env, request, corsCustomer);
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
        // API key is OPTIONAL and provides:
        // 1. CORS bypass for allowed origins
        // 2. Tenant isolation for OTP storage/retrieval
        //
        // CRITICAL: API key is for ACCESS CONTROL, not authentication!
        // - tenantCustomerId (from API key) = used for OTP retrieval (tenant-scoped storage)
        // - User's actual identity = looked up by EMAIL inside handleVerifyOTP
        // - User does NOT inherit API key owner's customerId, permissions, or super admin status
        const tenantCustomerId = apiKeyAuth?.customerId ?? null;
        const handlerResponse = await handleVerifyOTP(request, env, tenantCustomerId);
        
        // CORS: Use API key's per-key origins (not customer config)
        // Valid API key with origins → use those. Valid key without origins → ['*'] (allow any)
        const corsCustomer = apiKeyAuth 
            ? { config: { allowedOrigins: apiKeyAuth.allowedOrigins?.length ? apiKeyAuth.allowedOrigins : ['*'] } }
            : customer;
        const corsHeaders = getCorsHeaders(env, request, corsCustomer);
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
        const handlerResponse = await authHandlers.handleGetMe(request, env);
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
        const handlerResponse = await authHandlers.handleGetQuota(request, env, customerIdToPass);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId: customerIdToPass };
    }
    if (path === '/auth/logout' && request.method === 'POST') {
        const handlerResponse = await authHandlers.handleLogout(request, env);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return { response: handlerResponse, customerId };
    }
    
    // CRITICAL: User lookup endpoint removed - we ONLY use customerId, NO userId
    // The only lookup is email -> customerId for OTP to work
    
    return null; // Route not matched
}

