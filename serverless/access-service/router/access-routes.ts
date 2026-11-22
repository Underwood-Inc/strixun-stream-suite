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
import { createCORSHeaders } from '../utils/cors.js';
import { authenticateRequest, requireAuth, requireSuperAdmin } from '../utils/auth.js';
import { checkRateLimit, getRateLimitIdentifier, createRateLimitError, addRateLimitHeaders, RATE_LIMITS, type RateLimitConfig } from '../utils/rate-limit.js';
import { getCustomerAccess } from '../utils/access-kv.js';
import { resolveAuthRateBudgetFromEnv, unlimitedRateLimitResult } from '../utils/flag-rate-budget.js';
import type { AuthResult } from '../utils/auth.js';

export interface RouteResult {
    response: Response;
}

async function customerRolesForRateBudget(auth: AuthResult, env: Env): Promise<string[]> {
    if (auth.jwtPayload?.roles && Array.isArray(auth.jwtPayload.roles)) {
        return auth.jwtPayload.roles as string[];
    }
    if (!auth.customerId) return [];
    const access = await getCustomerAccess(auth.customerId, env);
    return access?.roles ?? [];
}

async function applyFlagRateBudget(
    auth: AuthResult | null,
    baseConfig: RateLimitConfig,
    identifier: string,
    env: Env,
) {
    if (env.ENVIRONMENT === 'test') {
        return {
            effectiveConfig: baseConfig,
            rateLimitResult: {
                allowed: true,
                remaining: baseConfig.maxRequests,
                resetAt: new Date(Date.now() + baseConfig.windowSeconds * 1000).toISOString(),
            },
        };
    }

    if (auth?.type === 'service') {
        const unlimited = unlimitedRateLimitResult();
        return { effectiveConfig: baseConfig, rateLimitResult: unlimited };
    }

    const customerId = auth?.customerId ?? null;
    const roles = auth?.type === 'jwt' && auth.customerId
        ? await customerRolesForRateBudget(auth, env)
        : [];
    const budget = await resolveAuthRateBudgetFromEnv(env, customerId, roles);

    if (budget.bypass) {
        return { effectiveConfig: baseConfig, rateLimitResult: unlimitedRateLimitResult() };
    }

    const effectiveConfig: RateLimitConfig = { ...baseConfig };
    if (budget.baseTries !== null) {
        effectiveConfig.maxRequests = Math.max(1, budget.baseTries);
    }

    const rateLimitResult = await checkRateLimit(identifier, effectiveConfig, env);
    return { effectiveConfig, rateLimitResult };
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
    if (path.startsWith('/access/roles') || path.startsWith('/access/permissions')) {
        rateLimitConfig = RATE_LIMITS.admin;
    } else if (request.method === 'POST') {
        rateLimitConfig = RATE_LIMITS.check;
    } else if (request.method === 'PUT' || request.method === 'DELETE') {
        rateLimitConfig = RATE_LIMITS.write;
    }
    
    const { effectiveConfig: rateLimitConfigEffective, rateLimitResult } = await applyFlagRateBudget(
        auth,
        rateLimitConfig,
        identifier,
        env,
    );

    if (!rateLimitResult.allowed) {
        return { response: createRateLimitError(rateLimitResult) };
    }
    
    // NOTE: No public /access/seed endpoint!
    // Seeding happens AUTOMATICALLY on first request (see worker.ts autoSeedDefaults)
    // This ensures defaults are always available without manual intervention
    
    // NOTE: Migrations are NOT exposed as HTTP endpoints for security reasons
    // Migrations run AUTOMATICALLY on first request (see worker.ts autoRunMigrations)
    // This ensures database schema is always up-to-date on every deploy

    // Role & permission definitions (SUPER ADMIN ONLY - CRITICAL SECURITY)
    if (path.startsWith('/access/roles') || path.startsWith('/access/permissions')) {
        // GET /access/roles (super-admin or service calls only)
        if (request.method === 'GET' && path === '/access/roles') {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListRoles(request, env) };
        }
        
        // GET /access/roles/:roleName (super-admin or service calls only)
        if (request.method === 'GET' && path.startsWith('/access/roles/')) {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleGetRole(request, env, roleName) };
        }
        
        // PUT /access/roles/:roleName (super-admin or service calls only)
        if (request.method === 'PUT' && path.startsWith('/access/roles/')) {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleSaveRole(request, env, roleName) };
        }
        
        // GET /access/permissions (super-admin or service calls only)
        if (request.method === 'GET' && path === '/access/permissions') {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListPermissions(request, env) };
        }
    }

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
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
        }
        
        // GET /access/:customerId/permissions
        if (parts.length === 3 && parts[2] === 'permissions') {
            const customerId = parts[1];
            const response = await handleGetPermissions(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
        }
        
        // GET /access/:customerId/roles
        if (parts.length === 3 && parts[2] === 'roles') {
            const customerId = parts[1];
            const response = await handleGetRoles(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
        }
        
        // GET /access/:customerId/quotas
        if (parts.length === 3 && parts[2] === 'quotas') {
            const customerId = parts[1];
            const response = await handleGetQuotas(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
        }
        
        // GET /access/:customerId/audit-log
        if (parts.length === 3 && parts[2] === 'audit-log') {
            const customerId = parts[1];
            const response = await handleGetAuditLog(request, env, customerId);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
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
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
        }
        
        // POST /access/check-quota
        if (path === '/access/check-quota') {
            const response = await handleCheckQuota(request, env);
            return { response: addRateLimitHeaders(response, rateLimitResult, rateLimitConfigEffective.maxRequests) };
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
            // Pass auth to handler for caller identification (prevents self-lockout)
            return { response: await handleAssignRoles(request, env, customerId, auth ?? undefined) };
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

    // Role & permission definitions (SUPER ADMIN ONLY - CRITICAL SECURITY)
    if (path.startsWith('/access/roles')) {
        // GET /access/roles (super-admin or service calls only)
        if (request.method === 'GET' && path === '/access/roles') {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListRoles(request, env) };
        }
        
        // GET /access/roles/:roleName (super-admin or service calls only)
        if (request.method === 'GET' && path.split('/').length === 4) {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleGetRole(request, env, roleName) };
        }
        
        // PUT /access/roles/:roleName (super-admin or service calls only)
        if (request.method === 'PUT' && path.split('/').length === 4) {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            const roleName = path.split('/')[3];
            return { response: await handleSaveRole(request, env, roleName) };
        }
    }

    if (path.startsWith('/access/permissions')) {
        // GET /access/permissions (super-admin or service calls only)
        if (request.method === 'GET' && path === '/access/permissions') {
            const authError = await requireSuperAdmin(auth, request, env);
            if (authError) return { response: authError };
            return { response: await handleListPermissions(request, env) };
        }
    }

    // Route not found
    return null;
}
