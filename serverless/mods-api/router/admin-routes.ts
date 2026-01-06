/**
 * Admin Routes
 * Handles admin endpoints for mod triage and management
 * All admin routes require super-admin authentication
 * 
 * Uses shared route protection system for consistent, secure access control
 */

import { wrapWithEncryption } from '@strixun/api-framework';
import { createCORSHeadersWithLocalhost } from '../utils/cors.js';
import { protectAdminRoute, type RouteProtectionEnv } from '@strixun/api-framework';
import { verifyJWT } from '../utils/auth.js';
import { createError } from '../utils/errors.js';

/**
 * Handle admin routes
 * All routes are protected at the API level using shared protection system
 */
export async function handleAdminRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    try {
        // Protect route with super-admin requirement
        // This ensures API-level protection - no data is returned if unauthorized
        const protection = await protectAdminRoute(
            request,
            env,
            'super-admin', // All mods-api admin routes require super-admin
            verifyJWT
        );

        // If not allowed, return error immediately (prevents any data download)
        if (!protection.allowed || !protection.auth) {
            // protectAdminRoute always returns an error when allowed is false
            // Use the error response from protection (which has correct status: 401 for auth, 403 for permission)
            if (protection.error) {
                return {
                    response: protection.error,
                    customerId: null
                };
            }
            // Fallback (should never happen, but handle gracefully)
            return {
                response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
                customerId: null
            };
        }

        const auth = protection.auth;

        const pathSegments = path.split('/').filter(Boolean);
        console.log('[AdminRoutes] Processing request', { path, pathSegments, method: request.method, pathSegmentsLength: pathSegments.length });

        // Route: GET /admin/mods - List all mods (for triage)
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'GET') {
            const { handleListAllMods } = await import('../handlers/admin/list.js');
            const response = await handleListAllMods(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: PUT /admin/mods/:modId/status - Update mod status (also accepts POST for backward compatibility)
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'status' && (request.method === 'PUT' || request.method === 'POST')) {
            const modId = pathSegments[2];
            console.log('[AdminRoutes] PUT /admin/mods/:modId/status matched', { modId, pathSegments, method: request.method });
            const { handleUpdateModStatus } = await import('../handlers/admin/triage.js');
            const response = await handleUpdateModStatus(request, env, modId, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: POST /admin/mods/:modId/comments - Add review comment
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'comments' && request.method === 'POST') {
            const modId = pathSegments[2];
            const { handleAddReviewComment } = await import('../handlers/admin/triage.js');
            const response = await handleAddReviewComment(request, env, modId, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: GET /admin/approvals - List approved uploaders
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'GET') {
            const { handleListApprovedUsers } = await import('../handlers/admin/approvals.js');
            const response = await handleListApprovedUsers(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: POST /admin/approvals/:userId - Approve user for uploads
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'POST') {
            const userId = pathSegments[2];
            const { handleApproveUser } = await import('../handlers/admin/approvals.js');
            const response = await handleApproveUser(request, env, userId, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: DELETE /admin/approvals/:userId - Revoke user upload permission
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'DELETE') {
            const userId = pathSegments[2];
            const { handleRevokeUser } = await import('../handlers/admin/approvals.js');
            const response = await handleRevokeUser(request, env, userId, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: DELETE /admin/mods/:modId - Delete mod (admin only, bypasses author check)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'DELETE') {
            const modId = pathSegments[2];
            console.log('[AdminRoutes] DELETE /admin/mods/:modId matched', { modId, pathSegments, method: request.method });
            const { handleAdminDeleteMod } = await import('../handlers/admin/delete.js');
            const response = await handleAdminDeleteMod(request, env, modId, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: GET /admin/r2/files - List all R2 files
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && request.method === 'GET') {
            const { handleListR2Files } = await import('../handlers/admin/r2-management.js');
            const response = await handleListR2Files(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: GET /admin/r2/duplicates - Detect duplicate and orphaned files
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'duplicates' && request.method === 'GET') {
            const { handleDetectDuplicates } = await import('../handlers/admin/r2-management.js');
            const response = await handleDetectDuplicates(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: DELETE /admin/r2/files/:key - Delete single R2 file
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && request.method === 'DELETE') {
            const key = decodeURIComponent(pathSegments[3]);
            const { handleDeleteR2File } = await import('../handlers/admin/r2-management.js');
            const response = await handleDeleteR2File(request, env, auth, key);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: POST /admin/r2/files/delete - Bulk delete R2 files
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && pathSegments[3] === 'delete' && request.method === 'POST') {
            const { handleDeleteR2File } = await import('../handlers/admin/r2-management.js');
            const response = await handleDeleteR2File(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: POST /admin/r2/cleanup - Manually trigger cleanup job (for testing)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'cleanup' && request.method === 'POST') {
            const { handleManualCleanup } = await import('../handlers/admin/r2-cleanup.js');
            const response = await handleManualCleanup(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: PUT /admin/r2/files/:key/timestamp - Set deletion timestamp (for testing only)
        if (pathSegments.length === 5 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && pathSegments[4] === 'timestamp' && request.method === 'PUT') {
            const key = decodeURIComponent(pathSegments[3]);
            const { handleSetDeletionTimestamp } = await import('../handlers/admin/r2-management.js');
            const response = await handleSetDeletionTimestamp(request, env, auth, key);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: GET /admin/settings - Get admin settings
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'settings' && request.method === 'GET') {
            const { handleGetSettings } = await import('../handlers/admin/settings.js');
            const response = await handleGetSettings(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: PUT /admin/settings - Update admin settings
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'settings' && request.method === 'PUT') {
            const { handleUpdateSettings } = await import('../handlers/admin/settings.js');
            const response = await handleUpdateSettings(request, env, auth);
            return await wrapWithEncryption(response, auth, request, env);
        }

        // Route: POST /admin/migrate/dry-run - Run migration analysis (no changes)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'migrate' && pathSegments[2] === 'dry-run' && request.method === 'POST') {
            const { dryRunVariantMigration } = await import('../scripts/migrate-variants-to-versions.js');
            const stats = await dryRunVariantMigration(env);
            const corsHeaders = createCORSHeadersWithLocalhost(request, env);
            const headers: Record<string, string> = {};
            corsHeaders.forEach((value, key) => {
                headers[key] = value;
            });
            return {
                response: new Response(JSON.stringify(stats, null, 2), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    }
                }),
                customerId: null
            };
        }

        // Route: POST /admin/migrate/run - Execute actual migration
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'migrate' && pathSegments[2] === 'run' && request.method === 'POST') {
            const { migrateAllVariantsToVersions } = await import('../scripts/migrate-variants-to-versions.js');
            const stats = await migrateAllVariantsToVersions(env);
            const corsHeaders = createCORSHeadersWithLocalhost(request, env);
            const headers: Record<string, string> = {};
            corsHeaders.forEach((value, key) => {
                headers[key] = value;
            });
            return {
                response: new Response(JSON.stringify(stats, null, 2), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    }
                }),
                customerId: null
            };
        }

        // 404 for unknown admin routes
        return null;
    } catch (error: any) {
        console.error('Admin routes error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'An error occurred while processing the admin request');
        const corsHeaders = createCORSHeadersWithLocalhost(request, env);
        const headers: Record<string, string> = {};
        corsHeaders.forEach((value, key) => {
            headers[key] = value;
        });
        return {
            response: new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...headers,
                },
            }),
            customerId: null
        };
    }
}

interface Env extends RouteProtectionEnv {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    SUPER_ADMIN_EMAILS?: string;
    ADMIN_EMAILS?: string; // Regular admin emails (for future use)
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

