/**
 * Shared Route Protection System
 * 
 * Provides centralized, secure route protection for admin routes across all services.
 * All JWT verification is RS256 via JWKS (OIDC). No HS256.
 * 
 * This system ensures:
 * - API-level protection (prevents data download on client)
 * - Consistent RS256 OIDC authentication across all services
 * - Support for both JWT and API key authentication
 * - Clear distinction between admin and super admin roles
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { extractTokenFromRequest, verifyWithJWKS } from '@strixun/oidc-jwt';

/**
 * Admin access level
 */
export type AdminLevel = 'admin' | 'super-admin';

/**
 * Authentication result from request
 */
export interface AuthResult {
    customerId: string;
    jwtToken?: string;
}

/**
 * Environment interface for route protection
 */
export interface RouteProtectionEnv {
    SUPER_ADMIN_EMAILS?: string;
    ADMIN_EMAILS?: string;
    SUPER_ADMIN_API_KEY?: string;
    ALLOWED_ORIGINS?: string;
    CUSTOMER_API_URL?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

/**
 * Route protection result
 */
export interface RouteProtectionResult {
    allowed: boolean;
    error?: Response;
    auth?: AuthResult;
    level?: AdminLevel;
}


/**
 * Verify super-admin API key
 */
export function verifySuperAdminKey(apiKey: string, env: RouteProtectionEnv): boolean {
    const superAdminKey = env.SUPER_ADMIN_API_KEY;
    if (!superAdminKey) {
        return false;
    }
    // Constant-time comparison to prevent timing attacks
    return apiKey === superAdminKey;
}

/**
 * Decode the payload of an already-verified JWT (no signature check).
 * Safe to call only AFTER token has been verified by authenticateJWT.
 */
function decodeVerifiedPayload(token: string): Record<string, any> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
    } catch {
        return null;
    }
}

/**
 * Authenticate request using JWT token.
 * RS256 via JWKS only (OIDC). Requires JWT_ISSUER in env.
 */
export async function authenticateJWT(
    token: string,
    env: RouteProtectionEnv,
): Promise<AuthResult | null> {
    const payload = await verifyWithJWKS(token, env);
    if (!payload || !payload.sub) return null;
    return {
        customerId: (payload.customerId as string) || (payload.sub as string),
        jwtToken: token,
    };
}

/**
 * Extract authentication from request.
 * Reads auth_token HttpOnly cookie or Authorization Bearer header,
 * then verifies via RS256 JWKS.
 */
export async function extractAuth(
    request: Request,
    env: RouteProtectionEnv,
): Promise<AuthResult | null> {
    const token = extractTokenFromRequest(request);
    if (!token) return null;
    return authenticateJWT(token, env);
}

/**
 * Create error response for unauthorized access
 */
export function createUnauthorizedResponse(
    request: Request,
    env: RouteProtectionEnv,
    message: string = 'Authentication required',
    code: string = 'UNAUTHORIZED'
): Response {
    const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    
    return new Response(JSON.stringify({
        error: message,
        code,
    }), {
        status: 401,
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });
}

/**
 * Create error response for forbidden access
 */
export function createForbiddenResponse(
    request: Request,
    env: RouteProtectionEnv,
    message: string = 'Admin access required',
    code: string = 'FORBIDDEN'
): Response {
    const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    
    return new Response(JSON.stringify({
        error: message,
        code,
    }), {
        status: 403,
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });
}

/**
 * Protect route with admin access requirement.
 * RS256 OIDC verification only.
 */
export async function protectAdminRoute(
    request: Request,
    env: RouteProtectionEnv,
    level: AdminLevel,
): Promise<RouteProtectionResult> {
    const auth = await extractAuth(request, env);
    
    // If no JWT authentication, deny access
    if (!auth) {
        return {
            allowed: false,
            error: createUnauthorizedResponse(request, env, 'Authentication required'),
        };
    }
    
    // Decode the already-verified JWT payload to read claims
    const jwtPayload = auth.jwtToken ? decodeVerifiedPayload(auth.jwtToken) : null;

    if (level === 'super-admin') {
        if (!auth.customerId) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Super admin access required', 'SUPER_ADMIN_REQUIRED'),
                auth,
            };
        }
        
        // Trust isSuperAdmin claim from RS256-verified JWT first
        if (jwtPayload?.isSuperAdmin === true) {
            return { allowed: true, auth, level: 'super-admin' };
        }

        // Fallback: Access Service for dynamically-assigned super-admin roles
        const { isSuperAdminByCustomerId } = await import('./customer-lookup.js');
        const isSuperAdmin = await isSuperAdminByCustomerId(auth.customerId, env);
        
        if (!isSuperAdmin) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Super admin access required', 'SUPER_ADMIN_REQUIRED'),
                auth,
            };
        }
        
        return { allowed: true, auth, level: 'super-admin' };
    } else {
        if (!auth.customerId) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Admin access required', 'ADMIN_REQUIRED'),
                auth,
            };
        }
        
        // Trust isSuperAdmin claim -- super-admins always pass admin checks
        if (jwtPayload?.isSuperAdmin === true) {
            return { allowed: true, auth, level: 'super-admin' };
        }

        const { getCustomerRoles } = await import('./customer-lookup.js');
        try {
            const roles = await getCustomerRoles(auth.customerId, env);
            const hasAdminAccess = roles.includes('admin') || roles.includes('super-admin');
            
            if (!hasAdminAccess) {
                return {
                    allowed: false,
                    error: createForbiddenResponse(request, env, 'Admin access required', 'ADMIN_REQUIRED'),
                    auth,
                };
            }
            
            const actualLevel = roles.includes('super-admin') ? 'super-admin' : 'admin';
            return { allowed: true, auth, level: actualLevel };
        } catch (error) {
            console.error('[RouteProtection] Failed to check admin roles:', error);
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Failed to verify admin access', 'AUTH_CHECK_FAILED'),
                auth,
            };
        }
    }
}

/**
 * Wrapper for admin route handlers.
 * Ensures route is protected before executing handler.
 */
export async function withAdminProtection(
    handler: (request: Request, env: RouteProtectionEnv, auth: AuthResult) => Promise<Response>,
    request: Request,
    env: RouteProtectionEnv,
    level: AdminLevel,
): Promise<Response> {
    const protection = await protectAdminRoute(request, env, level);
    
    if (!protection.allowed || !protection.auth) {
        return protection.error || createUnauthorizedResponse(request, env);
    }
    
    return handler(request, env, protection.auth);
}

