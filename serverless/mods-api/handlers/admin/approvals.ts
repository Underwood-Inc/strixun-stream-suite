/**
 * Admin approval handler
 * Handles user upload approval/revocation
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { isSuperAdminEmail, approveUserUpload, revokeUserUpload, getApprovedUploaders } from '../../utils/admin.js';

/**
 * Approve user for uploads
 * POST /admin/approvals/:userId
 */
export async function handleApproveUser(
    request: Request,
    env: Env,
    userId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Parse request (may include email for metadata)
        const requestData = await request.json().catch(() => ({})) as { email?: string };
        const email = requestData.email || '';

        await approveUserUpload(userId, email, env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, userId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Approve user error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Approve User',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while approving user'
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
 * Revoke user upload permission
 * DELETE /admin/approvals/:userId
 */
export async function handleRevokeUser(
    request: Request,
    env: Env,
    userId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        await revokeUserUpload(userId, env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, userId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Revoke user error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Revoke User',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while revoking user'
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
    auth: { userId: string; email?: string; customerId: string | null }
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

