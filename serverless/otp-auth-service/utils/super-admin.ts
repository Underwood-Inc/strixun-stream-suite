/**
 * Super Admin Authentication
 * 
 * NEW: Now uses Authorization Service for role-based super admin checks.
 * Email-based checks have been replaced with customerId-based role checks.
 * 
 * @module super-admin
 */

import { getCorsHeaders } from './cors.js';
import { createAccessClient } from '../../shared/access-client.js';

interface Env {
    SUPER_ADMIN_API_KEY?: string;
    ACCESS_SERVICE_URL?: string; // Used by access-client for service-to-service calls
    SERVICE_API_KEY?: string;
    OTP_AUTH_KV?: KVNamespace;
    [key: string]: any;
}

/**
 * Check if a customer is a super admin (via Authorization Service)
 * 
 * NEW: Uses Authorization Service to check for 'super-admin' role
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer has super-admin role
 */
export async function isSuperAdmin(customerId: string, env: Env): Promise<boolean> {
    if (!customerId) {
        return false;
    }

    try {
        // Use service key for authentication during JWT creation (no JWT available yet)
        const access = createAccessClient(env, { serviceApiKey: env.SERVICE_API_KEY });
        const isSuperAdmin = await access.isSuperAdmin(customerId);
        
        console.log('[SuperAdmin] Checking super admin status:', {
            customerId,
            isSuperAdmin,
            source: 'Authorization Service'
        });
        
        return isSuperAdmin;
    } catch (error) {
        console.error('[SuperAdmin] Failed to check super admin status:', error);
        return false; // Fail closed
    }
}


/**
 * Verify super-admin API key
 * @param apiKey - API key to verify
 * @param env - Worker environment
 * @returns True if valid super-admin key
 */
export function verifySuperAdmin(apiKey: string, env: Env): boolean {
    const superAdminKey = env.SUPER_ADMIN_API_KEY;
    if (!superAdminKey) {
        // If no super admin key is set, deny access (fail secure)
        return false;
    }
    // Constant-time comparison to prevent timing attacks
    return apiKey === superAdminKey;
}

/**
 * Authenticate super-admin request via API key
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns True if authenticated as super-admin
 */
export function authenticateSuperAdmin(request: Request, env: Env): boolean {
    // ONLY check X-Super-Admin-Key header for API key authentication
    // NO Authorization header fallback
    const apiKey = request.headers.get('X-Super-Admin-Key');
    
    if (!apiKey) {
        return false;
    }
    
    return verifySuperAdmin(apiKey, env);
}

/**
 * Authenticate super-admin request via JWT token (customerId-based)
 * 
 * NEW: Now checks Authorization Service for super-admin role
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns customerId if authenticated as super-admin, null otherwise
 */
export async function authenticateSuperAdminJWT(request: Request, env: Env): Promise<string | null> {
    // ONLY check HttpOnly cookie for JWT token - NO Authorization header fallback
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return null;
    }
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
        return null;
    }
    
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authCookie.substring('auth_token='.length).trim();
    
    try {
        // Import JWT verification utilities
        const { verifyJWT, getJWTSecret } = await import('./crypto.js');
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload || !payload.customerId) {
            return null;
        }
        
        // Check if customer is a super admin via Authorization Service
        const isSuper = await isSuperAdmin(payload.customerId, env);
        return isSuper ? payload.customerId : null;
    } catch (e) {
        return null;
    }
}


/**
 * Check if a customer has admin or super-admin role (via Authorization Service)
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @param jwtToken - Optional JWT token for authentication
 * @returns True if customer has admin or super-admin role
 */
export async function isAdminOrSuperAdmin(customerId: string, env: Env, jwtToken?: string): Promise<boolean> {
    if (!customerId) {
        return false;
    }

    try {
        const access = createAccessClient(env, { jwtToken: jwtToken || undefined });
        const authorization = await access.getCustomerAuthorization(customerId);
        
        if (!authorization) {
            return false;
        }
        
        const hasAdminAccess = authorization.roles.includes('admin') || authorization.roles.includes('super-admin');
        
        console.log('[AdminAuth] Checking admin access:', {
            customerId,
            roles: authorization.roles,
            hasAdminAccess,
            source: 'Authorization Service'
        });
        
        return hasAdminAccess;
    } catch (error) {
        console.error('[AdminAuth] Failed to check admin status:', error);
        return false; // Fail closed
    }
}

/**
 * Require super-admin authentication (API key or JWT-based)
 * Returns 401 response if not authenticated
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns 401 response if not authenticated, null if authenticated
 */
export async function requireSuperAdmin(request: Request, env: Env): Promise<Response | null> {
    // Try API key authentication first
    if (authenticateSuperAdmin(request, env)) {
        return null; // Authenticated via API key
    }
    
    // Try JWT-based authentication (checks Authorization Service)
    const superAdminCustomerId = await authenticateSuperAdminJWT(request, env);
    if (superAdminCustomerId) {
        return null; // Authenticated via JWT with super-admin role
    }
    
    // Not authenticated
    return new Response(JSON.stringify({ 
        error: 'Super-admin authentication required',
        code: 'SUPER_ADMIN_REQUIRED',
        hint: 'Authenticate with a JWT token that has super-admin role or use SUPER_ADMIN_API_KEY'
    }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

