/**
 * Super Admin Authentication
 * Handles super-admin authentication for system-level operations
 * 
 * Super admins are configured via Cloudflare environment variables or KV storage
 * Format: Comma-separated list of email addresses in SUPER_ADMIN_EMAILS
 */

import { getCorsHeaders } from './cors.js';
import { hashEmail } from './crypto.js';

interface Env {
    SUPER_ADMIN_API_KEY?: string;
    SUPER_ADMIN_EMAILS?: string;
    OTP_AUTH_KV?: KVNamespace;
    [key: string]: any;
}

/**
 * Get list of super admin emails from environment or KV
 */
async function getSuperAdminEmails(env: Env): Promise<string[]> {
    // First, check environment variable (comma-separated list)
    if (env.SUPER_ADMIN_EMAILS) {
        return env.SUPER_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
    }
    
    // Fallback: Check KV for super admin list
    if (env.OTP_AUTH_KV) {
        try {
            const kvEmails = await env.OTP_AUTH_KV.get('super_admin_emails');
            if (kvEmails) {
                return kvEmails.split(',').map(email => email.trim().toLowerCase());
            }
        } catch (e) {
            // If KV read fails, continue to API key check
        }
    }
    
    return [];
}

/**
 * Check if an email is a super admin
 */
export async function isSuperAdminEmail(email: string, env: Env): Promise<boolean> {
    if (!email) {
        return false;
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const superAdminEmails = await getSuperAdminEmails(env);
    
    return superAdminEmails.includes(normalizedEmail);
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
        apiKey = authHeader.substring(7);
    } else {
        apiKey = request.headers.get('X-Super-Admin-Key');
    }
    
    if (!apiKey) {
        return false;
    }
    
    return verifySuperAdmin(apiKey, env);
}

/**
 * Authenticate super-admin request via JWT token (email-based)
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Email if authenticated as super-admin, null otherwise
 */
export async function authenticateSuperAdminEmail(request: Request, env: Env): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
        // Import JWT verification utilities
        const { verifyJWT, getJWTSecret } = await import('./crypto.js');
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload || !payload.email) {
            return null;
        }
        
        // Check if email is a super admin
        const isSuperAdmin = await isSuperAdminEmail(payload.email, env);
        return isSuperAdmin ? payload.email : null;
    } catch (e) {
        return null;
    }
}

/**
 * Require super-admin authentication (API key or email-based)
 * Returns 401 response if not authenticated
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns 401 response if not authenticated, null if authenticated
 */
export async function requireSuperAdmin(request: Request, env: Env): Promise<Response | null> {
    // Try API key authentication first
    if (authenticateSuperAdmin(request, env)) {
        return null; // Authenticated via API key
    }
    
    // Try email-based authentication
    const superAdminEmail = await authenticateSuperAdminEmail(request, env);
    if (superAdminEmail) {
        return null; // Authenticated via email
    }
    
    // Not authenticated
    return new Response(JSON.stringify({ 
        error: 'Super-admin authentication required',
        code: 'SUPER_ADMIN_REQUIRED',
        hint: 'Set SUPER_ADMIN_API_KEY or SUPER_ADMIN_EMAILS environment variable. For email-based auth, use JWT token from dashboard login. For API key auth, use Authorization: Bearer <key> header'
    }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

