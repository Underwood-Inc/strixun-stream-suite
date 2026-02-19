/**
 * Dashboard Authentication Helpers
 * Shared authentication and authorization utilities for dashboard routes
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { verifyApiKey } from '../../services/api-key.js';
import { hashEmail } from '../../utils/crypto.js';
import { verifyTokenOIDC, extractAuthToken } from '../../utils/verify-token.js';
import { getEntity } from '@strixun/kv-entities';
// CRITICAL: wrapWithEncryption removed - main router handles ALL encryption (avoids double-encryption)

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
 * - JWT tokens ONLY from HttpOnly cookies (NO Authorization header)
 * - API keys from X-OTP-API-Key header (for service-to-service)
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
    // First check for API key in X-OTP-API-Key header (service-to-service auth)
    const apiKey = request.headers.get('X-OTP-API-Key');
    if (apiKey) {
        return await verifyApiKey(apiKey, env);
    }
    
    const token = extractAuthToken(request.headers.get('Cookie'));
    if (!token) {
        return null;
    }
    
    try {
        const payload = await verifyTokenOIDC(token, env);
        if (!payload) {
            return null;
        }
        
        // Check if token is in deny list (for security)
        const customerId = payload.customerId || null;
        const tokenHash = await hashEmail(token);
        const denied = await getEntity<{ token: string; revokedAt: string }>(
            env.OTP_AUTH_KV, 'otp-auth', 'jwt-denylist', `${customerId}_${tokenHash}`
        );
        if (denied) {
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
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            }), 
            customerId: null 
        };
    }
    
    const handlerResponse = await handler(request, env, auth.customerId);
    // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
    return { response: handlerResponse, customerId: auth.customerId };
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
        let isSuperAdminKey = false;
        
        // Check X-OTP-API-Key header for super-admin API key
        const apiKey = request.headers.get('X-OTP-API-Key');
        if (apiKey) {
            isSuperAdminKey = verifySuperAdmin(apiKey, env);
        }
        
        if (isSuperAdminKey) {
            const handlerResponse = await handler(request, env, null);
            // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
            return { response: handlerResponse, customerId: null };
        }
        
        return {
            response: new Response(JSON.stringify({
                error: 'Admin authentication required',
                code: 'AUTHENTICATION_REQUIRED'
            }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }
    
    const { isAdminOrSuperAdmin } = await import('../../utils/super-admin.js');
    // Extract jwtToken if auth is JwtAuth type
    const jwtToken = 'jwtToken' in auth ? auth.jwtToken : undefined;
    const hasAdminAccess = await isAdminOrSuperAdmin(auth.customerId!, env, jwtToken);
    
    if (!hasAdminAccess) {
        return {
            response: new Response(JSON.stringify({
                error: 'Admin role required',
                code: 'FORBIDDEN'
            }), {
                status: 403,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth.customerId
        };
    }
    
    const handlerResponse = await handler(request, env, auth.customerId);
    // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
    return { response: handlerResponse, customerId: auth.customerId };
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
        let isSuperAdminKey = false;
        
        // Check X-OTP-API-Key header for super-admin API key
        const apiKey = request.headers.get('X-OTP-API-Key');
        if (apiKey) {
            isSuperAdminKey = verifySuperAdmin(apiKey, env);
        }
        
        if (isSuperAdminKey) {
            const handlerResponse = await handler(request, env, null);
            // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
            return { response: handlerResponse, customerId: null };
        }
    }
    
    const handlerResponse = await handler(request, env, auth?.customerId || null);
    // CRITICAL: Do NOT encrypt here - main router handles ALL encryption (avoids double-encryption)
    return { response: handlerResponse, customerId: auth?.customerId || null };
}
