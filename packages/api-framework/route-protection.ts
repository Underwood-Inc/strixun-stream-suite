/**
 * Shared Route Protection System
 * 
 * Provides centralized, secure route protection for admin routes across all services.
 * Supports both regular admin and super admin access levels.
 * 
 * This system ensures:
 * - API-level protection (prevents data download on client)
 * - Consistent authentication across all services
 * - Support for both JWT and API key authentication
 * - Clear distinction between admin and super admin roles
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decodeJWTHeader, verifyRS256JWT } from './jwt.js';
import type { RSAPublicJWK } from './jwt.js';

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
    ADMIN_EMAILS?: string; // Regular admin emails (comma-separated)
    SUPER_ADMIN_API_KEY?: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    CUSTOMER_API_URL?: string; // For customer lookup
    NETWORK_INTEGRITY_KEYPHRASE?: string; // For service-to-service calls
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

let _jwksCache: { keys: RSAPublicJWK[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 600_000; // 10 minutes

async function fetchJWKS(env: RouteProtectionEnv): Promise<RSAPublicJWK[]> {
    if (_jwksCache && Date.now() - _jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
        return _jwksCache.keys;
    }
    const issuer = (env as any).JWT_ISSUER || (env as any).AUTH_SERVICE_URL;
    if (!issuer) return [];
    try {
        const res = await fetch(`${issuer}/.well-known/jwks.json`);
        if (!res.ok) return _jwksCache?.keys ?? [];
        const data = (await res.json()) as { keys: RSAPublicJWK[] };
        _jwksCache = { keys: data.keys, fetchedAt: Date.now() };
        return data.keys;
    } catch {
        return _jwksCache?.keys ?? [];
    }
}

/**
 * Authenticate request using JWT token.
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret).
 */
export async function authenticateJWT(
    token: string,
    env: RouteProtectionEnv,
    verifyJWT: (token: string, secret: string) => Promise<any>
): Promise<AuthResult | null> {
    try {
        const header = decodeJWTHeader(token);

        // RS256 path -- verify via JWKS
        if (header?.alg === 'RS256') {
            const keys = await fetchJWKS(env);
            const matchingKey = header.kid
                ? keys.find(k => k.kid === header.kid)
                : keys[0];
            if (matchingKey) {
                const payload = await verifyRS256JWT(token, matchingKey);
                if (payload && payload.sub) {
                    return {
                        customerId: (payload.customerId as string) || payload.sub,
                        jwtToken: token,
                    };
                }
            }
            // If RS256 verification failed, don't fall through to HS256
            return null;
        }

        // HS256 path -- legacy shared secret
        if (!env.JWT_SECRET) {
            return null;
        }
        const payload = await verifyJWT(token, env.JWT_SECRET);
        if (!payload || !payload.sub) {
            return null;
        }
        
        return {
            customerId: payload.customerId || payload.sub,
            jwtToken: token,
        };
    } catch {
        return null;
    }
}

/**
 * Extract authentication from request
 * Supports both JWT Bearer tokens and API keys
 */
export async function extractAuth(
    request: Request,
    env: RouteProtectionEnv,
    verifyJWT: (token: string, secret: string) => Promise<any>
): Promise<AuthResult | null> {
    let token: string | null = null;
    
    // PRIORITY 1: Check HttpOnly cookie (browser requests)
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        
        if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
        }
    }
    
    // PRIORITY 2: Check Authorization header (service-to-service calls)
    if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // CRITICAL: Trim token to ensure it matches the token used for encryption
            token = authHeader.substring(7).trim();
        }
    }
    
    if (!token) {
        return null;
    }
    
    return await authenticateJWT(token, env, verifyJWT);
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
 * Protect route with admin access requirement
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @param level - Required admin level ('admin' or 'super-admin')
 * @param verifyJWT - JWT verification function (service-specific)
 * @returns Protection result with auth info or error response
 */
export async function protectAdminRoute(
    request: Request,
    env: RouteProtectionEnv,
    level: AdminLevel,
    verifyJWT: (token: string, secret: string) => Promise<any>
): Promise<RouteProtectionResult> {
    // CRITICAL: Admin routes ALWAYS require JWT authentication
    // API keys are NOT authentication keys - they are for service identification only
    // Admin routes must have valid JWT with proper role verification
    
    // Authenticate the request (extracts JWT from HttpOnly cookie or Authorization header)
    const auth = await extractAuth(request, env, verifyJWT);
    
    // If no JWT authentication, deny access
    if (!auth) {
        return {
            allowed: false,
            error: createUnauthorizedResponse(request, env, 'Authentication required'),
        };
    }
    
    // Check admin level using Access Service
    if (level === 'super-admin') {
        // Use customerId to check super-admin role via Access Service
        if (!auth.customerId) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Super admin access required', 'SUPER_ADMIN_REQUIRED'),
                auth,
            };
        }
        
        const { isSuperAdminByCustomerId } = await import('./customer-lookup.js');
        const isSuperAdmin = await isSuperAdminByCustomerId(auth.customerId, env);
        
        if (!isSuperAdmin) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Super admin access required', 'SUPER_ADMIN_REQUIRED'),
                auth,
            };
        }
        
        return {
            allowed: true,
            auth,
            level: 'super-admin',
        };
    } else {
        // Regular admin - check via Access Service for admin OR super-admin role
        if (!auth.customerId) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Admin access required', 'ADMIN_REQUIRED'),
                auth,
            };
        }
        
        // Check if customer has admin or super-admin role via Access Service
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
            
            // Determine actual level based on roles
            const actualLevel = roles.includes('super-admin') ? 'super-admin' : 'admin';
            
            return {
                allowed: true,
                auth,
                level: actualLevel,
            };
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
 * Wrapper for admin route handlers
 * Ensures route is protected before executing handler
 * 
 * @param handler - Route handler function
 * @param request - HTTP request
 * @param env - Worker environment
 * @param level - Required admin level
 * @param verifyJWT - JWT verification function
 * @returns Response from handler or error response
 */
export async function withAdminProtection(
    handler: (request: Request, env: RouteProtectionEnv, auth: AuthResult) => Promise<Response>,
    request: Request,
    env: RouteProtectionEnv,
    level: AdminLevel,
    verifyJWT: (token: string, secret: string) => Promise<any>
): Promise<Response> {
    const protection = await protectAdminRoute(request, env, level, verifyJWT);
    
    if (!protection.allowed || !protection.auth) {
        return protection.error || createUnauthorizedResponse(request, env);
    }
    
    return handler(request, env, protection.auth);
}

