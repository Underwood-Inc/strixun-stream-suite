/**
 * Authorization Routes
 * 
 * Routes authorization requests to appropriate handlers.
 */

import type { Env } from '../types/authorization.js';
import { handleGetAuthz, handleGetPermissions, handleGetRoles, handleGetQuotas } from '../handlers/read.js';
import { handleCheckPermission, handleCheckQuota } from '../handlers/check.js';
import { handleAssignRoles, handleGrantPermissions, handleSetQuotas, handleResetQuotas, handleIncrementQuota } from '../handlers/manage.js';
import { handleListRoles, handleGetRole, handleSaveRole, handleListPermissions } from '../handlers/definitions.js';
import { handleGetAuditLog } from '../handlers/audit.js';
import { handleSeedDefaults } from '../handlers/seed.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

export interface RouteResult {
    response: Response;
}

/**
 * Handle authorization routes
 */
export async function handleAuthzRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // Seed default roles/permissions on first request (if not already seeded)
    // This is async and non-blocking - seed happens in background
    if (request.method === 'POST' && path === '/authz/seed') {
        return { response: await handleSeedDefaults(request, env) };
    }

    // NOTE: Migrations are NOT exposed as HTTP endpoints for security reasons
    // Migrations are run via GitHub Actions workflow after deployment
    // See: .github/workflows/deploy-authorization-service.yml

    // Read-only endpoints (any authenticated service can call these)
    if (request.method === 'GET' && path.startsWith('/authz/')) {
        const parts = path.split('/').filter(Boolean);
        
        // GET /authz/:customerId
        if (parts.length === 2) {
            const customerId = parts[1];
            return { response: await handleGetAuthz(request, env, customerId) };
        }
        
        // GET /authz/:customerId/permissions
        if (parts.length === 3 && parts[2] === 'permissions') {
            const customerId = parts[1];
            return { response: await handleGetPermissions(request, env, customerId) };
        }
        
        // GET /authz/:customerId/roles
        if (parts.length === 3 && parts[2] === 'roles') {
            const customerId = parts[1];
            return { response: await handleGetRoles(request, env, customerId) };
        }
        
        // GET /authz/:customerId/quotas
        if (parts.length === 3 && parts[2] === 'quotas') {
            const customerId = parts[1];
            return { response: await handleGetQuotas(request, env, customerId) };
        }
        
        // GET /authz/:customerId/audit-log
        if (parts.length === 3 && parts[2] === 'audit-log') {
            const customerId = parts[1];
            return { response: await handleGetAuditLog(request, env, customerId) };
        }
    }

    // Permission/quota checks (any authenticated service can call these)
    if (request.method === 'POST') {
        // POST /authz/check-permission
        if (path === '/authz/check-permission') {
            return { response: await handleCheckPermission(request, env) };
        }
        
        // POST /authz/check-quota
        if (path === '/authz/check-quota') {
            return { response: await handleCheckQuota(request, env) };
        }
    }

    // Management endpoints (admin-only)
    if (path.startsWith('/authz/') && path.includes('/')) {
        const parts = path.split('/').filter(Boolean);
        
        // PUT /authz/:customerId/roles
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'roles') {
            const customerId = parts[1];
            return { response: await handleAssignRoles(request, env, customerId) };
        }
        
        // PUT /authz/:customerId/permissions
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'permissions') {
            const customerId = parts[1];
            return { response: await handleGrantPermissions(request, env, customerId) };
        }
        
        // PUT /authz/:customerId/quotas
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'quotas') {
            const customerId = parts[1];
            return { response: await handleSetQuotas(request, env, customerId) };
        }
        
        // POST /authz/:customerId/quotas/reset
        if (request.method === 'POST' && parts.length === 4 && parts[2] === 'quotas' && parts[3] === 'reset') {
            const customerId = parts[1];
            return { response: await handleResetQuotas(request, env, customerId) };
        }
        
        // POST /authz/:customerId/quotas/increment
        if (request.method === 'POST' && parts.length === 4 && parts[2] === 'quotas' && parts[3] === 'increment') {
            const customerId = parts[1];
            return { response: await handleIncrementQuota(request, env, customerId) };
        }
    }

    // Role & permission definitions (admin-only)
    if (path.startsWith('/authz/roles')) {
        // GET /authz/roles
        if (request.method === 'GET' && path === '/authz/roles') {
            return { response: await handleListRoles(request, env) };
        }
        
        // GET /authz/roles/:roleName
        if (request.method === 'GET' && path.split('/').length === 4) {
            const roleName = path.split('/')[3];
            return { response: await handleGetRole(request, env, roleName) };
        }
        
        // PUT /authz/roles/:roleName
        if (request.method === 'PUT' && path.split('/').length === 4) {
            const roleName = path.split('/')[3];
            return { response: await handleSaveRole(request, env, roleName) };
        }
    }

    if (path.startsWith('/authz/permissions')) {
        // GET /authz/permissions
        if (request.method === 'GET' && path === '/authz/permissions') {
            return { response: await handleListPermissions(request, env) };
        }
    }

    // Route not found
    return null;
}
