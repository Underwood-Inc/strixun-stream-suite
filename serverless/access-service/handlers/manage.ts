/**
 * Management Handlers
 * 
 * PUT/POST endpoints for managing customer authorization.
 * Admin-only endpoints (require super-admin permission check).
 */

import type { Env, CustomerAuthorization, QuotaInfo } from '../types/authorization.js';
import { getCustomerAccess, saveCustomerAccess, listRoleDefinitions, addAuditLog } from '../utils/access-kv.js';
import { createCORSHeaders } from '../utils/cors.js';

/**
 * Calculate reset timestamp for a quota period
 */
function calculateResetAt(period: 'day' | 'month' | 'year'): string {
    const now = new Date();
    const reset = new Date(now);
    
    if (period === 'day') {
        reset.setDate(reset.getDate() + 1);
        reset.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        reset.setMonth(reset.getMonth() + 1);
        reset.setDate(1);
        reset.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
        reset.setFullYear(reset.getFullYear() + 1);
        reset.setMonth(0);
        reset.setDate(1);
        reset.setHours(0, 0, 0, 0);
    }
    
    return reset.toISOString();
}

/**
 * PUT /access/:customerId/roles
 * Assign roles to a customer
 */
export async function handleAssignRoles(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { roles: string[]; reason?: string };
        
        if (!body.roles || !Array.isArray(body.roles)) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'roles array is required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        // Get or create authorization data
        let access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            access = {
                customerId,
                roles: [],
                permissions: [],
                quotas: {},
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: 'manual',
                },
            };
        }
        
        // Update roles
        const oldRoles = [...access.roles];
        access.roles = body.roles;
        access.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            access.metadata.reason = body.reason;
        }
        
        // Apply default quotas from roles
        const roleDefinitions = await listRoleDefinitions(env);
        const roleMap = new Map(roleDefinitions.map(r => [r.name, r]));
        
        for (const roleName of body.roles) {
            const role = roleMap.get(roleName);
            if (role && role.defaultQuotas) {
                for (const [resource, quotaConfig] of Object.entries(role.defaultQuotas)) {
                    if (!access.quotas[resource]) {
                        access.quotas[resource] = {
                            limit: quotaConfig.limit,
                            period: quotaConfig.period,
                            current: 0,
                            resetAt: calculateResetAt(quotaConfig.period),
                        };
                    }
                }
            }
        }
        
        // Resolve permissions from roles
        const resolvedPermissions = new Set<string>();
        for (const roleName of body.roles) {
            const role = roleMap.get(roleName);
            if (role) {
                role.permissions.forEach(p => resolvedPermissions.add(p));
            }
        }
        access.permissions = Array.from(resolvedPermissions);
        
        // Save
        await saveCustomerAccess(access, env);
        
        // Audit log
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'role_added',
            details: { oldRoles, newRoles: body.roles },
            performedBy: 'system', // TODO: Get from JWT
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(access), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[AssignRoles] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
}

/**
 * PUT /access/:customerId/permissions
 * Grant specific permissions to a customer
 */
export async function handleGrantPermissions(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { permissions: string[]; reason?: string };
        
        if (!body.permissions || !Array.isArray(body.permissions)) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'permissions array is required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        let access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            access = {
                customerId,
                roles: [],
                permissions: [],
                quotas: {},
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: 'manual',
                },
            };
        }
        
        const oldPermissions = [...access.permissions];
        access.permissions = body.permissions;
        access.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            access.metadata.reason = body.reason;
        }
        
        await saveCustomerAccess(access, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'permission_granted',
            details: { oldPermissions, newPermissions: body.permissions },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(access), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GrantPermissions] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
}

/**
 * PUT /access/:customerId/quotas
 * Set quotas for a customer
 */
export async function handleSetQuotas(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { 
            quotas: { [resource: string]: { limit: number; period: 'day' | 'month' | 'year' } };
            reason?: string;
        };
        
        if (!body.quotas) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'quotas object is required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        let access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            access = {
                customerId,
                roles: [],
                permissions: [],
                quotas: {},
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: 'manual',
                },
            };
        }
        
        // Update quotas
        for (const [resource, quotaConfig] of Object.entries(body.quotas)) {
            access.quotas[resource] = {
                limit: quotaConfig.limit,
                period: quotaConfig.period,
                current: access.quotas[resource]?.current || 0,
                resetAt: calculateResetAt(quotaConfig.period),
            };
        }
        
        access.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            access.metadata.reason = body.reason;
        }
        
        await saveCustomerAccess(access, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'quota_updated',
            details: { quotas: body.quotas },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(access), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[SetQuotas] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
}

/**
 * POST /access/:customerId/quotas/reset
 * Reset quota counters for a customer
 */
export async function handleResetQuotas(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { resources?: string[]; reason?: string };
        
        const access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Authorization data not found for customer: ${customerId}`,
                code: 'ACCESS_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const resourcesToReset = body.resources || Object.keys(access.quotas);
        
        for (const resource of resourcesToReset) {
            if (access.quotas[resource]) {
                access.quotas[resource].current = 0;
                access.quotas[resource].resetAt = calculateResetAt(access.quotas[resource].period);
            }
        }
        
        access.metadata.updatedAt = new Date().toISOString();
        
        await saveCustomerAccess(access, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'quota_reset',
            details: { resources: resourcesToReset },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(access), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[ResetQuotas] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
}

/**
 * POST /access/:customerId/quotas/increment
 * Increment quota usage (called by services after consuming resource)
 */
export async function handleIncrementQuota(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { resource: string; amount?: number };
        
        if (!body.resource) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'resource is required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Authorization data not found for customer: ${customerId}`,
                code: 'ACCESS_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const amount = body.amount || 1;
        
        if (access.quotas[body.resource]) {
            access.quotas[body.resource].current += amount;
            access.metadata.updatedAt = new Date().toISOString();
            await saveCustomerAccess(access, env);
        }
        
        return new Response(JSON.stringify({
            success: true,
            quota: access.quotas[body.resource] || null,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[IncrementQuota] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_ERROR',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
}
