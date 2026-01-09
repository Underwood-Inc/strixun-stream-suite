/**
 * Admin approval handler
 * Handles customer upload approval/revocation
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { isSuperAdminEmail, approveCustomerUpload, revokeCustomerUpload, getApprovedUploaders } from '../../utils/admin.js';

/**
 * Approve customer for uploads
 * POST /admin/approvals/:customerId
 */
export async function handleApproveCustomer(
    request: Request,
    env: Env,
    customerId: string,
    auth: { customerId: string; email?: string; customerIdExternal: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures customer is super admin
        // Parse request (may include email for metadata)
        const requestData = await request.json().catch(() => ({})) as { email?: string };
        const email = requestData.email || '';

        await approveCustomerUpload(customerId, email, env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, customerId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Approve customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Approve Customer',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while approving customer'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Revoke customer upload permission
 * DELETE /admin/approvals/:customerId
 */
export async function handleRevokeCustomer(
    request: Request,
    env: Env,
    customerId: string,
    auth: { customerId: string; email?: string; customerIdExternal: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures customer is super admin
        await revokeCustomerUpload(customerId, env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, customerId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Revoke customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Revoke Customer',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while revoking customer'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * List approved uploaders
 * GET /admin/approvals
 */
export async function handleListApprovedUsers(
    request: Request,
    env: Env,
    auth: { customerId: string; email?: string }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        const approvedUsers = await getApprovedUploaders(env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ approvedUsers }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('List approved users error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Approved Users',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing approved users'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

