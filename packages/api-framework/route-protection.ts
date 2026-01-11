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

/**
 * Admin access level
 */
export type AdminLevel = 'admin' | 'super-admin';

/**
 * Authentication result from request
 */
export interface AuthResult {
    customerId: string;
    email?: string;
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

/**
 * Authenticate request using JWT token
 * This is a generic JWT verification that can be customized per service
 */
export async function authenticateJWT(
    token: string,
    env: RouteProtectionEnv,
    verifyJWT: (token: string, secret: string) => Promise<any>
): Promise<AuthResult | null> {
    try {
        if (!env.JWT_SECRET) {
            return null;
        }
        
        const payload = await verifyJWT(token, env.JWT_SECRET);
        if (!payload || !payload.sub) {
            return null;
        }
        
        return {
            customerId: payload.customerId,
            email: payload.email,
            jwtToken: token,
        };
    } catch (error) {
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
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
        return await authenticateJWT(token, env, verifyJWT);
    }
    
    return null;
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
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
    // First, try to authenticate the request
    const auth = await extractAuth(request, env, verifyJWT);
    
    // Check for super admin API key (service-to-service calls)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
        if (verifySuperAdminKey(token, env)) {
            // Super admin API key authenticated - allow access
            return {
                allowed: true,
                level: 'super-admin',
            };
        }
    }
    
    // If no auth and no API key, require authentication
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
        // Regular admin - check via Access Service (TODO: implement admin role check)
        if (!auth.customerId) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Admin access required', 'ADMIN_REQUIRED'),
                auth,
            };
        }
        
        // For now, check if super-admin (admins can be added later)
        const { isSuperAdminByCustomerId } = await import('./customer-lookup.js');
        const isSuperAdmin = await isSuperAdminByCustomerId(auth.customerId, env);
        
        if (!isSuperAdmin) {
            return {
                allowed: false,
                error: createForbiddenResponse(request, env, 'Admin access required', 'ADMIN_REQUIRED'),
                auth,
            };
        }
        
        return {
            allowed: true,
            auth,
            level: 'super-admin', // Super admins have admin access too
        };
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

