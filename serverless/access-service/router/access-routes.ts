/**
 * Access Control Routes
 * 
 * Routes access control requests to appropriate handlers.
 */

import type { Env } from '../types/authorization.js';
import { handleGetAccess, handleGetPermissions, handleGetRoles, handleGetQuotas } from '../handlers/read.js';
import { handleCheckPermission, handleCheckQuota } from '../handlers/check.js';
import { handleAssignRoles, handleGrantPermissions, handleSetQuotas, handleResetQuotas, handleIncrementQuota } from '../handlers/manage.js';
import { handleListRoles, handleGetRole, handleSaveRole, handleListPermissions } from '../handlers/definitions.js';
import { handleGetAuditLog } from '../handlers/audit.js';
import { handleSeedDefaults } from '../handlers/seed.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { authenticateRequest, requireAuth } from '../utils/auth.js';
import { checkRateLimit, getRateLimitIdentifier, createRateLimitError, addRateLimitHeaders, RATE_LIMITS } from '../utils/rate-limit.js';

export interface RouteResult {
    response: Response;
}

/**
 * Handle access control routes
 */
export async function handleAccessRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // Authenticate request (JWT or service key)
    const auth = await authenticateRequest(request, env);
    
    // Apply rate limiting based on endpoint type
    const identifier = getRateLimitIdentifier(request, auth);
    let rateLimitConfig = RATE_LIMITS.read; // Default
    
    // Determine rate limit type based on path and method
    if (path === '/access/seed' || path.startsWith('/access/roles') || path.startsWith('/access/permissions')) {
        rateLimitConfig = RATE_LIMITS.admin;
    } else if (request.method === 'POST') {
        rateLimitConfig = RATE_LIMITS.check;
    } else if (request.method === 'PUT' || request.method === 'DELETE') {
        rateLimitConfig = RATE_LIMITS.write;
    }
    
    // Check rate limit
    const rateLimitResult = await checkRateLimit(identifier, rateLimitConfig, env);
    if (!rateLimitResult.allowed) {
        return { response: createRateLimitError(rateLimitResult) };
    }
    
    // Seed endpoint requires authentication
    if (request.method === 'POST' && path === '/access/seed') {
        const authError = requireAuth(auth, request, env);
        if (authError) return { response: authError };
        const response = await handleSeedDefaults(request, env);
        return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
    }

    // NOTE: Migrations are NOT exposed as HTTP endpoints for security reasons
    // Migrations are run via GitHub Actions workflow after deployment
    // See: .github/workflows/deploy-access-service.yml

    // Read-only endpoints (REQUIRE AUTHENTICATION - service-to-service calls only)
    if (request.method === 'GET' && path.startsWith('/access/')) {
        // SECURITY: Require authentication for ALL read operations
        const authError = requireAuth(auth, request, env);
        if (authError) return { response: authError };
        
        const parts = path.split('/').filter(Boolean);
        
        // GET /access/:customerId
        if (parts.length === 2) {
            const customerId = parts[1];
            const response = await handleGetAccess(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
        
        // GET /access/:customerId/permissions
        if (parts.length === 3 && parts[2] === 'permissions') {
            const customerId = parts[1];
            const response = await handleGetPermissions(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
        
        // GET /access/:customerId/roles
        if (parts.length === 3 && parts[2] === 'roles') {
            const customerId = parts[1];
            const response = await handleGetRoles(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
        
        // GET /access/:customerId/quotas
        if (parts.length === 3 && parts[2] === 'quotas') {
            const customerId = parts[1];
            const response = await handleGetQuotas(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
        
        // GET /access/:customerId/audit-log
        if (parts.length === 3 && parts[2] === 'audit-log') {
            const customerId = parts[1];
            const response = await handleGetAuditLog(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
    }

    // Permission/quota checks (REQUIRE AUTHENTICATION - service-to-service calls only)
    if (request.method === 'POST') {
        // SECURITY: Require authentication for ALL permission/quota checks
        const authError = requireAuth(auth, request, env);
        if (authError) return { response: authError };
        
        // POST /access/check-permission
        if (path === '/access/check-permission') {
            const response = await handleCheckPermission(request, env);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
        
        // POST /access/check-quota
        if (path === '/access/check-quota') {
            const response = await handleCheckQuota(request, env);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfig.maxRequests) };
        }
    }

    // Management endpoints (WRITE - require authentication)
    if (path.startsWith('/access/') && path.includes('/')) {
        const parts = path.split('/').filter(Boolean);
        
        // PUT /access/:customerId/roles
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'roles') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const customerId = parts[1];
            return { response: await handleAssignRoles(request, env, customerId) };
        }
        
        // PUT /access/:customerId/permissions
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'permissions') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const customerId = parts[1];
            return { response: await handleGrantPermissions(request, env, customerId) };
        }
        
        // PUT /access/:customerId/quotas
        if (request.method === 'PUT' && parts.length === 3 && parts[2] === 'quotas') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const customerId = parts[1];
            return { response: await handleSetQuotas(request, env, customerId) };
        }
        
        // POST /access/:customerId/quotas/reset
        if (request.method === 'POST' && parts.length === 4 && parts[2] === 'quotas' && parts[3] === 'reset') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const customerId = parts[1];
            return { response: await handleResetQuotas(request, env, customerId) };
        }
        
        // POST /access/:customerId/quotas/increment (service calls OK - used by mods API)
        if (request.method === 'POST' && parts.length === 4 && parts[2] === 'quotas' && parts[3] === 'increment') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const customerId = parts[1];
            return { response: await handleIncrementQuota(request, env, customerId) };
        }
    }

    // Role & permission definitions
    if (path.startsWith('/access/roles')) {
        // GET /access/roles (service calls OK)
        if (request.method === 'GET' && path === '/access/roles') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListRoles(request, env) };
        }
        
        // GET /access/roles/:roleName (service calls OK)
        if (request.method === 'GET' && path.split('/').length === 4) {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleGetRole(request, env, roleName) };
        }
        
        // PUT /access/roles/:roleName (WRITE - require auth)
        if (request.method === 'PUT' && path.split('/').length === 4) {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleSaveRole(request, env, roleName) };
        }
    }

    if (path.startsWith('/access/permissions')) {
        // GET /access/permissions (service calls OK)
        if (request.method === 'GET' && path === '/access/permissions') {
            const authError = requireAuth(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListPermissions(request, env) };
        }
    }

    // Route not found
    return null;
}
