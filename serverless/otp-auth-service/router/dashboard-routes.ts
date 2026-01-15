/**
 * Dashboard Routes - Main Router
 * Delegates to specialized route modules for better organization
 * 
 * Most routes are customer-scoped and only require regular authentication.
 * Customers can access their own data (analytics, audit logs, API keys, etc.)
 * 
 * Some routes require super-admin authentication (for system-level operations)
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../utils/cors.js';
import { requireSuperAdmin } from '../utils/super-admin.js';
// CRITICAL: wrapWithEncryption removed - main router handles ALL encryption (avoids double-encryption)
// @ts-ignore - JS handlers don't have type declarations
import * as adminHandlers from '../handlers/admin.js';
// @ts-ignore - JS handlers don't have type declarations
import * as domainHandlers from '../handlers/domain.js';
// @ts-ignore - JS handlers don't have type declarations
import * as publicHandlers from '../handlers/public.js';
// @ts-ignore - JS handlers don't have type declarations
import * as debugHandlers from '../handlers/auth/debug.js';
// @ts-ignore - JS handlers don't have type declarations
import * as dataRequestHandlers from '../handlers/admin/data-requests.js';

// Import auth helpers
import { authenticateRequest, handleAdminRoute, handleSuperAdminRoute, handleAdminOrSuperAdminRoute, type RouteResult } from './dashboard/auth.js';

// Import sub-routers
import { handleAnalyticsRoutes } from './dashboard/analytics-routes.js';
import { handleRolesRoutes } from './dashboard/roles-routes.js';
import { handleAuditRoutes } from './dashboard/audit-routes.js';
import { handleConfigRoutes } from './dashboard/config-routes.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    SUPER_ADMIN_API_KEY?: string;
    SUPER_ADMIN_EMAILS?: string;
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * Main dashboard routes handler
 * Delegates to specialized sub-routers for each functional area
 */
export async function handleDashboardRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Try sub-routers first
    const analyticsResult = await handleAnalyticsRoutes(path, request, env);
    if (analyticsResult) return analyticsResult;

    const rolesResult = await handleRolesRoutes(path, request, env);
    if (rolesResult) return rolesResult;

    const auditResult = await handleAuditRoutes(path, request, env);
    if (auditResult) return auditResult;

    const configResult = await handleConfigRoutes(path, request, env);
    if (configResult) return configResult;

    // Legacy/deprecated routes
    if (path === '/admin/customers/me') {
        const corsHeaders = getCorsHeaders(env, request);
        const errorResponse = new Response(JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.5.9',
            title: 'Gone',
            status: 410,
            detail: 'This endpoint has been deprecated. Please use /customer/me from customer-api instead.',
            instance: request.url,
        }), {
            status: 410,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        const auth = await authenticateRequest(request, env);
        // CRITICAL: Do NOT encrypt here - main router handles ALL encryption
        return {
            response: errorResponse,
            customerId: auth && 'customerId' in auth ? auth.customerId : null,
        };
    }

    // Super-admin endpoint: Create customer
    if (path === '/admin/customers' && request.method === 'POST') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await publicHandlers.handleRegisterCustomer(request, env), customerId: null };
    }

    // Domain verification endpoints
    if (path === '/admin/domains/verify' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(domainHandlers.handleRequestDomainVerification, request, env, auth);
    }

    const domainStatusMatch = path.match(/^\/admin\/domains\/([^\/]+)\/status$/);
    if (domainStatusMatch && request.method === 'GET') {
        const domain = domainStatusMatch[1];
        const auth = await authenticateRequest(request, env);
        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }
        return { response: await domainHandlers.handleGetDomainStatus(request, env, domain), customerId: auth.customerId };
    }

    const domainVerifyMatch = path.match(/^\/admin\/domains\/([^\/]+)\/verify$/);
    if (domainVerifyMatch && request.method === 'POST') {
        const domain = domainVerifyMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => domainHandlers.handleVerifyDomain(req, e, cid, domain), request, env, auth);
    }

    // Customer Management endpoints
    // NOTE: GET /admin/customers has been moved to customer-api for proper separation of concerns
    // OTP-auth-service handles auth-related customer operations (status, GDPR) only

    // GDPR endpoints
    const exportCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/export$/);
    if (exportCustomerMatch && request.method === 'POST') {
        const customerId = exportCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleAdminOrSuperAdminRoute((req, e, cid) => adminHandlers.handleExportCustomerData(req, e, cid, customerId), request, env, auth);
    }

    const deleteCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)$/);
    if (deleteCustomerMatch && request.method === 'DELETE') {
        const customerId = deleteCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => adminHandlers.handleDeleteCustomerData(req, e, cid, customerId), request, env, auth);
    }

    // API key management endpoints
    const customerApiKeysMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys$/);
    if (customerApiKeysMatch) {
        const pathCustomerId = customerApiKeysMatch[1];
        const auth = await authenticateRequest(request, env);

        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }

        if (request.method === 'GET') {
            return {
                response: await adminHandlers.handleListApiKeys(request, env, pathCustomerId),
                customerId: auth.customerId
            };
        }

        if (request.method === 'POST') {
            return {
                response: await adminHandlers.handleCreateApiKey(request, env, pathCustomerId),
                customerId: auth.customerId
            };
        }
    }

    const revokeApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)$/);
    if (revokeApiKeyMatch && request.method === 'DELETE') {
        const pathCustomerId = revokeApiKeyMatch[1];
        const keyId = revokeApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);

        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }

        return {
            response: await adminHandlers.handleRevokeApiKey(request, env, pathCustomerId, keyId),
            customerId: auth.customerId
        };
    }

    const revealApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/reveal$/);
    if (revealApiKeyMatch && request.method === 'POST') {
        const pathCustomerId = revealApiKeyMatch[1];
        const keyId = revealApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);

        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }

        return {
            response: await adminHandlers.handleRevealApiKey(request, env, pathCustomerId, keyId),
            customerId: auth.customerId
        };
    }

    const rotateApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/rotate$/);
    if (rotateApiKeyMatch && request.method === 'POST') {
        const pathCustomerId = rotateApiKeyMatch[1];
        const keyId = rotateApiKeyMatch[2];
        const auth = await authenticateRequest(request, env);

        if (!auth) {
            return {
                response: new Response(JSON.stringify({ error: 'Authentication required' }), {
                    status: 401,
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: null
            };
        }

        return {
            response: await adminHandlers.handleRotateApiKey(request, env, pathCustomerId, keyId),
            customerId: auth.customerId
        };
    }

    // Customer status management endpoints
    const suspendCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/suspend$/);
    if (suspendCustomerMatch && request.method === 'POST') {
        const customerId = suspendCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => adminHandlers.handleSuspendCustomer(req, e, cid, customerId), request, env, auth);
    }

    const activateCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/activate$/);
    if (activateCustomerMatch && request.method === 'POST') {
        const customerId = activateCustomerMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => adminHandlers.handleActivateCustomer(req, e, cid, customerId), request, env, auth);
    }

    const updateStatusMatch = path.match(/^\/admin\/customers\/([^\/]+)\/status$/);
    if (updateStatusMatch && request.method === 'PUT') {
        const customerId = updateStatusMatch[1];
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute((req, e, cid) => adminHandlers.handleUpdateCustomerStatus(req, e, cid, customerId), request, env, auth);
    }

    // Debug endpoints
    if (path === '/admin/debug/clear-rate-limit' && request.method === 'POST') {
        const auth = await authenticateRequest(request, env);
        return handleSuperAdminRoute(debugHandlers.handleClearRateLimit, request, env, auth);
    }

    // Data request endpoints (super-admin only)
    if (path === '/admin/data-requests' && request.method === 'POST') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleCreateDataRequest(request, env), customerId: null };
    }

    if (path === '/admin/data-requests' && request.method === 'GET') {
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleListDataRequests(request, env), customerId: null };
    }

    const dataRequestMatch = path.match(/^\/admin\/data-requests\/([^\/]+)$/);
    if (dataRequestMatch && request.method === 'GET') {
        const requestId = dataRequestMatch[1];
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return { response: authError, customerId: null };
        }
        return { response: await dataRequestHandlers.handleGetDataRequest(request, env, requestId), customerId: null };
    }

    return null; // Route not matched
}
