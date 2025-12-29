/**
 * Handle get user permissions request
 * GET /mods/permissions/me
 * Returns the current user's upload permission status
 */

import { createError } from '../../utils/errors.js';
import { createCORSHeadersWithLocalhost } from '../../utils/cors.js';
import { hasUploadPermission, isSuperAdminEmail } from '../../utils/admin.js';

/**
 * Handle get user permissions
 * Returns upload permission status for the authenticated user
 */
export async function handleGetUserPermissions(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check if user has upload permission
        const hasPermission = await hasUploadPermission(auth.userId, auth.email, env);
        const isSuperAdmin = auth.email ? await isSuperAdminEmail(auth.email, env) : false;
        
        const corsHeaders = createCORSHeadersWithLocalhost(request, env);
        
        return new Response(JSON.stringify({
            hasPermission: hasPermission,
            isSuperAdmin: isSuperAdmin,
            userId: auth.userId,
            // CRITICAL: email is NEVER returned - it remains encrypted in the OTP auth service
            // Use displayName from customer account for user identification
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            'Failed to check user permissions'
        );
        const corsHeaders = createCORSHeadersWithLocalhost(request, env);
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

