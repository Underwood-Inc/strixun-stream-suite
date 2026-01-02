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
 * 
 * PRIMARY SOURCE: env.SUPER_ADMIN_EMAILS (from .dev.vars for local dev, or Cloudflare secrets for production)
 * FALLBACK: KV storage (only used if env var is not set - mainly for production runtime updates)
 * 
 * For local development: Set SUPER_ADMIN_EMAILS in .dev.vars
 * For production: Set via wrangler secret put SUPER_ADMIN_EMAILS or Cloudflare Dashboard
 */
async function getSuperAdminEmails(env: Env): Promise<string[]> {
    // PRIMARY: Check environment variable first (from .dev.vars in local dev, or Cloudflare secrets in production)
    if (env.SUPER_ADMIN_EMAILS) {
        const emails = env.SUPER_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
        console.log('[SuperAdmin] ✓ Loaded from env.SUPER_ADMIN_EMAILS:', {
            count: emails.length,
            emails: emails,
            source: 'environment variable (.dev.vars or Cloudflare secrets)'
        });
        return emails;
    }
    
    // FALLBACK: Check KV for super admin list (only if env var not set)
    // NOTE: In local dev with --local flag, KV is stored locally in ~/.wrangler/state/v3/kv/
    // This fallback is mainly for production where admins might update KV directly
    if (env.OTP_AUTH_KV) {
        try {
            const kvEmails = await env.OTP_AUTH_KV.get('super_admin_emails');
            if (kvEmails) {
                const emails = kvEmails.split(',').map(email => email.trim().toLowerCase());
                console.log('[SuperAdmin] ⚠ Loaded from KV fallback (env.SUPER_ADMIN_EMAILS not set):', {
                    count: emails.length,
                    emails: emails,
                    source: 'KV storage (fallback)',
                    note: 'Set SUPER_ADMIN_EMAILS in .dev.vars for local dev to avoid KV dependency'
                });
                return emails;
            }
        } catch (e) {
            console.warn('[SuperAdmin] KV read failed:', e);
        }
    }
    
    console.warn('[SuperAdmin] ✗ No super admin emails found - super admin access DISABLED');
    console.warn('[SuperAdmin]   Set SUPER_ADMIN_EMAILS in .dev.vars (local dev) or Cloudflare secrets (production)');
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
    const isSuperAdmin = superAdminEmails.includes(normalizedEmail);
    
    console.log('[SuperAdmin] Checking super admin status:', {
        email: normalizedEmail,
        isSuperAdmin: isSuperAdmin,
        superAdminEmails: superAdminEmails,
        emailInList: superAdminEmails.includes(normalizedEmail)
    });
    
    return isSuperAdmin;
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
    
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authHeader.substring(7).trim();
    
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

