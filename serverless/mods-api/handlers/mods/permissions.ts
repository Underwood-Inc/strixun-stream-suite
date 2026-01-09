/**
 * Handle get customer permissions request
 * GET /mods/permissions/me
 * Returns the current customer's upload permission status
 */

import { createError } from '../../utils/errors.js';
import { createCORSHeadersWithLocalhost } from '../../utils/cors.js';
import { hasUploadPermission, isSuperAdminEmail } from '../../utils/admin.js';

/**
 * Handle get customer permissions
 * Returns upload permission status for the authenticated customer
 */
export async function handleGetCustomerPermissions(
    request: Request,
    env: Env,
    auth: { customerId: string }
): Promise<Response> {
    try {
        // Check if customer has upload permission (all authenticated users can upload)
        const hasPermission = await hasUploadPermission(auth.customerId, env);
        
        console.log('[Permissions] Customer permission check:', {
            customerId: auth.customerId,
            hasPermission,
        });
        
        const corsHeaders = createCORSHeadersWithLocalhost(request, env);
        
        const responseData = {
            hasPermission: hasPermission,
            customerId: auth.customerId,
            // CRITICAL: email is NEVER returned - it remains encrypted in the OTP auth service
            // Use displayName from customer account for customer identification
        };
        
        console.log('[Permissions] Returning response:', responseData);
        
        return new Response(JSON.stringify(responseData), {
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
            'Failed to check customer permissions'
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

