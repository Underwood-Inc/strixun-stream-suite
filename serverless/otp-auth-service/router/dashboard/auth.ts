/**
 * Dashboard Authentication Helpers
 * Shared authentication and authorization utilities for dashboard routes
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { verifyApiKey } from '../../services/api-key.js';
import { verifyJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import { wrapWithEncryption } from '@strixun/api-framework';

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
    customerId: string;
    jwtToken: string;
}

export type AuthResult = ApiKeyAuth | JwtAuth | null;

export interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Authenticate request using API key or JWT token
 * Supports both authentication methods for backward compatibility and dashboard access
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else {
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
        let resolvedCustomerId = customerId;
        if (payload.email) {
            try {
                const { ensureCustomerAccount } = await import('../../handlers/auth/customer-creation.js');
                resolvedCustomerId = await ensureCustomerAccount(payload.email, customerId, env);
            } catch (error) {
                console.error(`[Dashboard Auth] Failed to ensure customer account for ${payload.email}:`, error);
                return null;
            }
        }
        
        if (!resolvedCustomerId) {
            return null;
        }
        
        return {
            customerId: resolvedCustomerId,
            jwtToken: token,
        } as JwtAuth;
    } catch (error) {
        return null;
    }
}

/**
 * Helper to wrap admin route handlers with authentication check, customerId tracking and encryption
 * Used for routes that require regular authentication (not super-admin)
 */
export async function handleAdminRoute(
    handler: (request: Request, env: Env, customerId: string | null) => Promise<Response>,
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<RouteResult> {
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
    
    const handlerResponse = await handler(request, env, auth.customerId);
    return await wrapWithEncryption(handlerResponse, auth, request, env);
}

/**
 * Helper to wrap admin route handlers with admin-level check (admin OR super-admin)
 */
export async function handleAdminOrSuperAdminRoute(
    handler: (request: Request, env: Env, customerId: string | null) => Promise<Response>,
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<RouteResult> {
    if (!auth) {
        const { verifySuperAdmin } = await import('../../utils/super-admin.js');
        const authHeader = request.headers.get('Authorization');
        let isSuperAdminKey = false;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7).trim();
            isSuperAdminKey = verifySuperAdmin(token, env);
        } else {
            const apiKey = request.headers.get('X-OTP-API-Key');
            if (apiKey) {
                isSuperAdminKey = verifySuperAdmin(apiKey, env);
            }
        }
        
        if (isSuperAdminKey) {
            const handlerResponse = await handler(request, env, null);
            return await wrapWithEncryption(handlerResponse, null, request, env);
        }
        
        return {
            response: new Response(JSON.stringify({
                error: 'Admin authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }
    
    const { isAdminOrSuperAdmin } = await import('../../utils/super-admin.js');
    const hasAdminAccess = await isAdminOrSuperAdmin(auth.customerId!, env);
    
    if (!hasAdminAccess) {
        return {
            response: new Response(JSON.stringify({
                error: 'Admin role required',
                code: 'FORBIDDEN'
            }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth.customerId
        };
    }
    
    const handlerResponse = await handler(request, env, auth.customerId);
    return await wrapWithEncryption(handlerResponse, auth, request, env);
}

/**
 * Helper to wrap super-admin route handlers with super-admin check
 */
export async function handleSuperAdminRoute(
    handler: (request: Request, env: Env, customerId: string | null) => Promise<Response>,
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<RouteResult> {
    const { requireSuperAdmin } = await import('../../utils/super-admin.js');
    const superAdminError = await requireSuperAdmin(request, env);
    
    if (superAdminError) {
        return { response: superAdminError, customerId: null };
    }
    
    if (!auth) {
        const { verifySuperAdmin } = await import('../../utils/super-admin.js');
        const authHeader = request.headers.get('Authorization');
        let isSuperAdminKey = false;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7).trim();
            isSuperAdminKey = verifySuperAdmin(token, env);
        } else {
            const apiKey = request.headers.get('X-OTP-API-Key');
            if (apiKey) {
                isSuperAdminKey = verifySuperAdmin(apiKey, env);
            }
        }
        
        if (isSuperAdminKey) {
            const handlerResponse = await handler(request, env, null);
            return await wrapWithEncryption(handlerResponse, null, request, env);
        }
    }
    
    const handlerResponse = await handler(request, env, auth?.customerId || null);
    return await wrapWithEncryption(handlerResponse, auth, request, env);
}
