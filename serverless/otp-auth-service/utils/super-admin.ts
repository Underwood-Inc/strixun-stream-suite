/**
 * Super Admin Authentication
 * 
 * NEW: Now uses Authorization Service for role-based super admin checks.
 * Email-based checks have been replaced with customerId-based role checks.
 * 
 * @module super-admin
 */

import { getCorsHeaders } from './cors.js';
import { createAuthzClient } from '../../shared/authz-client.js';

interface Env {
    SUPER_ADMIN_API_KEY?: string;
    AUTHORIZATION_SERVICE_URL?: string;
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
        const authz = createAuthzClient(env);
        const isSuperAdmin = await authz.isSuperAdmin(customerId);
        
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
 * DEPRECATED: Email-based super admin check
 * 
 * @deprecated Use isSuperAdmin(customerId, env) instead
 * 
 * This function is kept for backward compatibility during migration.
 * It now checks if the email is in SUPER_ADMIN_EMAILS env var (migration fallback only).
 */
export async function isSuperAdminEmail(email: string, env: Env): Promise<boolean> {
    if (!email) {
        return false;
    }

    console.warn('[SuperAdmin] DEPRECATED: isSuperAdminEmail() called. Use isSuperAdmin(customerId, env) instead.');

    // Fallback: Check SUPER_ADMIN_EMAILS env var (for migration period only)
    if (env.SUPER_ADMIN_EMAILS) {
        const normalizedEmail = email.trim().toLowerCase();
        const superAdminEmails = env.SUPER_ADMIN_EMAILS
            .split(',')
            .map((e: string) => e.trim().toLowerCase());
        
        return superAdminEmails.includes(normalizedEmail);
    }

    return false;
}

/**
 * Get list of super admin emails from environment
 * 
 * DEPRECATED: This is only used during migration to seed the Authorization Service.
 * 
 * @deprecated Use Authorization Service to manage roles
 */
async function getSuperAdminEmails(env: Env): Promise<string[]> {
    console.warn('[SuperAdmin] DEPRECATED: getSuperAdminEmails() called. Use Authorization Service instead.');

    if (env.SUPER_ADMIN_EMAILS) {
        const emails = env.SUPER_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
        return emails;
    }

    if (env.OTP_AUTH_KV) {
        try {
            const kvEmails = await env.OTP_AUTH_KV.get('super_admin_emails');
            if (kvEmails) {
                return kvEmails.split(',').map(email => email.trim().toLowerCase());
            }
        } catch (e) {
            console.warn('[SuperAdmin] KV read failed:', e);
        }
    }

    return [];
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
    const authHeader = request.headers.get('Authorization');
    let apiKey: string | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        apiKey = authHeader.substring(7).trim();
    } else {
        apiKey = request.headers.get('X-Super-Admin-Key');
    }
    
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
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authHeader.substring(7).trim();
    
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
 * DEPRECATED: Email-based authentication
 * @deprecated Use authenticateSuperAdminJWT() instead
 */
export async function authenticateSuperAdminEmail(request: Request, env: Env): Promise<string | null> {
    console.warn('[SuperAdmin] DEPRECATED: authenticateSuperAdminEmail() called. Use authenticateSuperAdminJWT() instead.');
    
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7).trim();
    
    try {
        const { verifyJWT, getJWTSecret } = await import('./crypto.js');
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload || !payload.email) {
            return null;
        }
        
        // Fallback: Check email against SUPER_ADMIN_EMAILS env var
        const isSuperAdminCheck = await isSuperAdminEmail(payload.email, env);
        return isSuperAdminCheck ? payload.email : null;
    } catch (e) {
        return null;
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
