/**
 * Admin Routes
 * Handles admin endpoints for mod triage and management
 * All admin routes require super-admin authentication
 * 
 * Auth delegates to auth service /auth/me (same path as mod routes).
 */

import { wrapWithEncryption } from '@strixun/api-framework';
import { getCorsHeaders } from '../utils/cors.js';
import { createError } from '../utils/errors.js';
import { authenticateRequest } from '../utils/auth.js';

/**
 * Handle admin routes
 * Protected via auth service delegation (same as /mods/* routes).
 */
export async function handleAdminRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    try {
        const auth = await authenticateRequest(request, env);

        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required', code: 'UNAUTHORIZED' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }),
                customerId: null,
            };
        }

        if (!auth.isSuperAdmin) {
            return {
                response: new Response(JSON.stringify({ error: 'Admin access required', code: 'ADMIN_REQUIRED' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                }),
                customerId: auth.customerId,
            };
        }
        
        // CRITICAL: Detect if request is using HttpOnly cookie (browser request)
        // If yes, we must disable response encryption because JavaScript can't access HttpOnly cookies to decrypt
        const cookieHeader = request.headers.get('Cookie');
        const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
        
        // For HttpOnly cookie requests, pass null to wrapWithEncryption to disable encryption
        // For Authorization header requests (service-to-service), pass auth object to enable encryption
        const authForEncryption = isHttpOnlyCookie ? null : auth;

        const pathSegments = path.split('/').filter(Boolean);
        console.log('[AdminRoutes] Processing request', { path, pathSegments, method: request.method, pathSegmentsLength: pathSegments.length });

        // Route: GET /admin/mods - List all mods (for triage)
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'GET') {
            const { handleListAllMods } = await import('../handlers/admin/list.js');
            const response = await handleListAllMods(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: PUT /admin/mods/:modId/status - Update mod status (also accepts POST for backward compatibility)
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'status' && (request.method === 'PUT' || request.method === 'POST')) {
            const modId = pathSegments[2];
            console.log('[AdminRoutes] PUT /admin/mods/:modId/status matched', { modId, pathSegments, method: request.method });
            const { handleUpdateModStatus } = await import('../handlers/admin/triage.js');
            const response = await handleUpdateModStatus(request, env, modId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: POST /admin/mods/:modId/comments - Add review comment
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && pathSegments[3] === 'comments' && request.method === 'POST') {
            const modId = pathSegments[2];
            const { handleAddReviewComment } = await import('../handlers/admin/triage.js');
            const response = await handleAddReviewComment(request, env, modId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/approvals - List approved uploaders
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'GET') {
            const { handleListApprovedUsers } = await import('../handlers/admin/approvals.js');
            const response = await handleListApprovedUsers(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: POST /admin/approvals/:userId - Approve user for uploads
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'POST') {
            const userId = pathSegments[2];
            const { handleApproveCustomer } = await import('../handlers/admin/approvals.js');
            const response = await handleApproveCustomer(request, env, userId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: DELETE /admin/approvals/:userId - Revoke user upload permission
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'DELETE') {
            const userId = pathSegments[2];
            const { handleRevokeCustomer } = await import('../handlers/admin/approvals.js');
            const response = await handleRevokeCustomer(request, env, userId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/approvals - List approved uploaders
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'approvals' && request.method === 'GET') {
            const { handleListApprovedUsers } = await import('../handlers/admin/approvals.js');
            const response = await handleListApprovedUsers(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // ===== Enriched Customer Routes =====
        
        // Route: GET /admin/customers - List all customers with enriched data (aggregated from customer-api + access-service + mods-api)
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && request.method === 'GET') {
            const { handleListCustomersEnriched } = await import('../handlers/admin/customers.js');
            const response = await handleListCustomersEnriched(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/customers/:customerId - Get single customer with enriched data
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && request.method === 'GET') {
            const customerId = pathSegments[2];
            const { handleGetCustomerEnriched } = await import('../handlers/admin/customers.js');
            const response = await handleGetCustomerEnriched(request, env, customerId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: PUT /admin/customers/:customerId - Update customer (proxies to customer-api, returns enriched data)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && request.method === 'PUT') {
            const customerId = pathSegments[2];
            const { handleUpdateCustomerEnriched } = await import('../handlers/admin/customers.js');
            const response = await handleUpdateCustomerEnriched(request, env, customerId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/customers/:customerId/mods - Get customer's mods (mod data, not customer data)
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && pathSegments[3] === 'mods' && request.method === 'GET') {
            const customerId = pathSegments[2];
            const { handleGetCustomerMods } = await import('../handlers/admin/customer-mods.js');
            const response = await handleGetCustomerMods(request, env, customerId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: DELETE /admin/mods/:modId - Delete mod (admin only, bypasses author check)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'mods' && request.method === 'DELETE') {
            const modId = pathSegments[2];
            console.log('[AdminRoutes] DELETE /admin/mods/:modId matched', { modId, pathSegments, method: request.method });
            const { handleAdminDeleteMod } = await import('../handlers/admin/delete.js');
            const response = await handleAdminDeleteMod(request, env, modId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/r2/files - List all R2 files
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && request.method === 'GET') {
            const { handleListR2Files } = await import('../handlers/admin/r2-management.js');
            const response = await handleListR2Files(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/r2/duplicates - Detect duplicate and orphaned files
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'duplicates' && request.method === 'GET') {
            const { handleDetectDuplicates } = await import('../handlers/admin/r2-management.js');
            const response = await handleDetectDuplicates(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: DELETE /admin/r2/files/:key - Delete single R2 file
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && request.method === 'DELETE') {
            const key = decodeURIComponent(pathSegments[3]);
            const { handleDeleteR2File } = await import('../handlers/admin/r2-management.js');
            const response = await handleDeleteR2File(request, env, auth, key);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: POST /admin/r2/files/delete - Bulk delete R2 files
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && pathSegments[3] === 'delete' && request.method === 'POST') {
            const { handleDeleteR2File } = await import('../handlers/admin/r2-management.js');
            const response = await handleDeleteR2File(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: POST /admin/r2/cleanup - Manually trigger cleanup job (for testing)
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'cleanup' && request.method === 'POST') {
            const { handleManualCleanup } = await import('../handlers/admin/r2-cleanup.js');
            const response = await handleManualCleanup(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: PUT /admin/r2/files/:key/timestamp - Set deletion timestamp (for testing only)
        if (pathSegments.length === 5 && pathSegments[0] === 'admin' && pathSegments[1] === 'r2' && pathSegments[2] === 'files' && pathSegments[4] === 'timestamp' && request.method === 'PUT') {
            const key = decodeURIComponent(pathSegments[3]);
            const { handleSetDeletionTimestamp } = await import('../handlers/admin/r2-management.js');
            const response = await handleSetDeletionTimestamp(request, env, auth, key);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/settings - Get admin settings
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'settings' && request.method === 'GET') {
            const { handleGetSettings } = await import('../handlers/admin/settings.js');
            const response = await handleGetSettings(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: PUT /admin/settings - Update admin settings
        if (pathSegments.length === 2 && pathSegments[0] === 'admin' && pathSegments[1] === 'settings' && request.method === 'PUT') {
            const { handleUpdateSettings } = await import('../handlers/admin/settings.js');
            const response = await handleUpdateSettings(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // ===== KV Browser Routes =====

        // Route: GET /admin/kv/keys - List KV keys
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'kv' && pathSegments[2] === 'keys' && request.method === 'GET') {
            const { handleListKVKeys } = await import('../handlers/admin/kv-browser.js');
            const response = await handleListKVKeys(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/kv/prefixes - Get KV key prefixes for navigation
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'kv' && pathSegments[2] === 'prefixes' && request.method === 'GET') {
            const { handleGetKVPrefixes } = await import('../handlers/admin/kv-browser.js');
            const response = await handleGetKVPrefixes(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/kv/keys/:encodedKey - Get single KV key value
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'kv' && pathSegments[2] === 'keys' && request.method === 'GET') {
            const encodedKey = pathSegments[3];
            const { handleGetKVValue } = await import('../handlers/admin/kv-browser.js');
            const response = await handleGetKVValue(request, env, encodedKey, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // ===== Entity Browser Routes =====

        // Route: GET /admin/entities/mods - List all mods with counts
        if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'entities' && pathSegments[2] === 'mods' && request.method === 'GET') {
            const { handleListModEntities } = await import('../handlers/admin/entities.js');
            const response = await handleListModEntities(request, env, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // Route: GET /admin/entities/mods/:modId - Get mod entity detail
        if (pathSegments.length === 4 && pathSegments[0] === 'admin' && pathSegments[1] === 'entities' && pathSegments[2] === 'mods' && request.method === 'GET') {
            const modId = pathSegments[3];
            const { handleGetModEntityDetail } = await import('../handlers/admin/entities.js');
            const response = await handleGetModEntityDetail(request, env, modId, auth);
            return await wrapWithEncryption(response, authForEncryption, request, env, {
                requireJWT: authForEncryption ? true : false
            });
        }

        // 404 for unknown admin routes
        return null;
    } catch (error: any) {
        console.error('Admin routes error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'An error occurred while processing the admin request');
        const corsHeaders = getCorsHeaders(env, request);
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

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    SUPER_ADMIN_EMAILS?: string;
    ADMIN_EMAILS?: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

