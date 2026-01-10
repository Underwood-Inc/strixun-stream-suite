/**
 * Handle get customer permissions request
 * GET /mods/permissions/me
 * Returns the current customer's permissions from Authorization Service
 */

import { createError } from '../../utils/errors.js';
import { createCORSHeadersWithLocalhost } from '../../utils/cors.js';
import { getCustomerPermissionInfo } from '../../utils/admin.js';

/**
 * Handle get customer permissions
 * Returns full authorization details for the authenticated customer
 */
export async function handleGetCustomerPermissions(
    request: Request,
    env: Env,
    auth: { customerId: string }
): Promise<Response> {
    try {
        // Get full permission info from Authorization Service
        const permissionInfo = await getCustomerPermissionInfo(auth.customerId, env);
        
        console.log('[Permissions] Customer permission check:', {
            customerId: auth.customerId,
            roles: permissionInfo.roles,
            hasUploadPermission: permissionInfo.hasUploadPermission,
        });
        
        const corsHeaders = createCORSHeadersWithLocalhost(request, env);
        
        const responseData = {
            customerId: auth.customerId,
            hasUploadPermission: permissionInfo.hasUploadPermission,
            isAdmin: permissionInfo.isAdmin,
            isSuperAdmin: permissionInfo.isSuperAdmin,
            roles: permissionInfo.roles,
            permissions: permissionInfo.permissions,
            quotas: permissionInfo.quotas || {},
            // CRITICAL: email is NEVER returned - it remains encrypted in the OTP auth service
            // Use displayName from customer account for customer identification
        };
        
        console.log('[Permissions] Returning response with', responseData.permissions.length, 'permissions');
        
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

