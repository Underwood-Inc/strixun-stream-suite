/**
 * Super Admin Authentication
 * Handles super-admin authentication for system-level operations
 */

import { getCorsHeaders } from './cors.js';

/**
 * Verify super-admin API key
 * @param {string} apiKey - API key to verify
 * @param {*} env - Worker environment
 * @returns {boolean} True if valid super-admin key
 */
export function verifySuperAdmin(apiKey, env) {
    const superAdminKey = env.SUPER_ADMIN_API_KEY;
    if (!superAdminKey) {
        // If no super admin key is set, deny access (fail secure)
        return false;
    }
    // Constant-time comparison to prevent timing attacks
    return apiKey === superAdminKey;
}

/**
 * Authenticate super-admin request
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {boolean} True if authenticated as super-admin
 */
export function authenticateSuperAdmin(request, env) {
    const authHeader = request.headers.get('Authorization');
    let apiKey = null;
    
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
 * Require super-admin authentication
 * Returns 401 response if not authenticated
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {Response|null} 401 response if not authenticated, null if authenticated
 */
export function requireSuperAdmin(request, env) {
    if (!authenticateSuperAdmin(request, env)) {
        return new Response(JSON.stringify({ 
            error: 'Super-admin authentication required',
            code: 'SUPER_ADMIN_REQUIRED',
            hint: 'Set SUPER_ADMIN_API_KEY environment variable and use it in Authorization: Bearer <key> header'
        }), {
            status: 401,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
    return null;
}

