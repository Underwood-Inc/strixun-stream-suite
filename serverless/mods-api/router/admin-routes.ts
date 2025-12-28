/**
 * Admin Routes
 * Handles admin endpoints for mod triage and management
 * All admin routes require super-admin authentication
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import { authenticateRequest } from '../utils/auth.js';
import { isSuperAdminEmail } from '../utils/admin.js';
import { wrapWithEncryption } from '@strixun/api-framework';

/**
 * Handle admin routes
 */
export async function handleAdminRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    try {
        // Authenticate request
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify(rfcError), {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                }),
                customerId: null
            };
        }

        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return {
                response: new Response(JSON.stringify(rfcError), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                }),
                customerId: auth.customerId || null
            };
        }

        const pathSegments = path.split('/').filter(Boolean);

        // Route: GET /admin/mods - List all mods (for triage)
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'GET') {
            const { handleListAllMods } = await import('../handlers/admin/list.js');
            const response = await handleListAllMods(request, env, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /admin/mods/:modId/status - Update mod status
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'status' && request.method === 'POST') {
            const modId = pathSegments[2];
            const { handleUpdateModStatus } = await import('../handlers/admin/triage.js');
            const response = await handleUpdateModStatus(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /admin/mods/:modId/comments - Add review comment
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'comments' && request.method === 'POST') {
            const modId = pathSegments[2];
            const { handleAddReviewComment } = await import('../handlers/admin/triage.js');
            const response = await handleAddReviewComment(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /admin/approvals - List approved uploaders
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'GET') {
            const { handleListApprovedUsers } = await import('../handlers/admin/approvals.js');
            const response = await handleListApprovedUsers(request, env, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /admin/approvals/:userId - Approve user for uploads
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'POST') {
            const userId = pathSegments[2];
            const { handleApproveUser } = await import('../handlers/admin/approvals.js');
            const response = await handleApproveUser(request, env, userId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: DELETE /admin/approvals/:userId - Revoke user upload permission
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'DELETE') {
            const userId = pathSegments[2];
            const { handleRevokeUser } = await import('../handlers/admin/approvals.js');
            const response = await handleRevokeUser(request, env, userId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: DELETE /admin/mods/:modId - Delete mod (admin only, bypasses author check)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'DELETE') {
            const modId = pathSegments[2];
            const { handleAdminDeleteMod } = await import('../handlers/admin/delete.js');
            const response = await handleAdminDeleteMod(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // 404 for unknown admin routes
        return null;
    } catch (error: any) {
        console.error('Admin routes error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'An error occurred while processing the admin request');
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return {
            response: new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            }),
            customerId: null
        };
    }
}

interface Env {
    MODS_KV: KVNamespace;
    SUPER_ADMIN_EMAILS?: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

