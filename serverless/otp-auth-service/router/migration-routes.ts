/**
 * Migration Routes
 * Handles database migration endpoints (super admin only)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleMigrationEndpoint } from '../migrations/migrate-api-keys-sso.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Handle migration routes
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @param customerId - Authenticated customer ID
 * @param isSuperAdmin - Super admin status
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleMigrationRoutes(
    request: Request,
    path: string,
    env: Env,
    customerId: string | null,
    isSuperAdmin: boolean
): Promise<RouteResult | null> {
    // All migration routes require super admin authentication
    if (!customerId || !isSuperAdmin) {
        if (path.startsWith('/migrations/')) {
            return {
                response: new Response(JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Super admin authentication required for migrations'
                }), {
                    status: 403,
                    headers: {
                        ...getCorsHeaders(env, request),
                        'Content-Type': 'application/json'
                    }
                }),
                customerId: null
            };
        }
        return null; // Not a migration route
    }
    
    // POST /migrations/api-keys-sso - Migrate API keys to add SSO configuration
    if (path === '/migrations/api-keys-sso' && request.method === 'POST') {
        return {
            response: await handleMigrationEndpoint(request, env, isSuperAdmin),
            customerId
        };
    }
    
    // No match
    return null;
}
