/**
 * Management Handlers
 * 
 * PUT/POST endpoints for managing customer authorization.
 * Admin-only endpoints (require super-admin permission check).
 */

import type { Env, CustomerAuthorization, QuotaInfo } from '../types/authorization.js';
import { getCustomerAuthz, saveCustomerAuthz, listRoleDefinitions, addAuditLog } from '../utils/authz-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

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
 * PUT /authz/:customerId/roles
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
        let authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
            authz = {
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
        const oldRoles = [...authz.roles];
        authz.roles = body.roles;
        authz.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            authz.metadata.reason = body.reason;
        }
        
        // Apply default quotas from roles
        const roleDefinitions = await listRoleDefinitions(env);
        const roleMap = new Map(roleDefinitions.map(r => [r.name, r]));
        
        for (const roleName of body.roles) {
            const role = roleMap.get(roleName);
            if (role && role.defaultQuotas) {
                for (const [resource, quotaConfig] of Object.entries(role.defaultQuotas)) {
                    if (!authz.quotas[resource]) {
                        authz.quotas[resource] = {
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
        authz.permissions = Array.from(resolvedPermissions);
        
        // Save
        await saveCustomerAuthz(authz, env);
        
        // Audit log
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'role_added',
            details: { oldRoles, newRoles: body.roles },
            performedBy: 'system', // TODO: Get from JWT
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(authz), {
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
 * PUT /authz/:customerId/permissions
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
        
        let authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
            authz = {
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
        
        const oldPermissions = [...authz.permissions];
        authz.permissions = body.permissions;
        authz.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            authz.metadata.reason = body.reason;
        }
        
        await saveCustomerAuthz(authz, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'permission_granted',
            details: { oldPermissions, newPermissions: body.permissions },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(authz), {
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
 * PUT /authz/:customerId/quotas
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
        
        let authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
            authz = {
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
            authz.quotas[resource] = {
                limit: quotaConfig.limit,
                period: quotaConfig.period,
                current: authz.quotas[resource]?.current || 0,
                resetAt: calculateResetAt(quotaConfig.period),
            };
        }
        
        authz.metadata.updatedAt = new Date().toISOString();
        if (body.reason) {
            authz.metadata.reason = body.reason;
        }
        
        await saveCustomerAuthz(authz, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'quota_updated',
            details: { quotas: body.quotas },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(authz), {
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
 * POST /authz/:customerId/quotas/reset
 * Reset quota counters for a customer
 */
export async function handleResetQuotas(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as { resources?: string[]; reason?: string };
        
        const authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Authorization data not found for customer: ${customerId}`,
                code: 'AUTHZ_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const resourcesToReset = body.resources || Object.keys(authz.quotas);
        
        for (const resource of resourcesToReset) {
            if (authz.quotas[resource]) {
                authz.quotas[resource].current = 0;
                authz.quotas[resource].resetAt = calculateResetAt(authz.quotas[resource].period);
            }
        }
        
        authz.metadata.updatedAt = new Date().toISOString();
        
        await saveCustomerAuthz(authz, env);
        
        await addAuditLog(customerId, {
            timestamp: new Date().toISOString(),
            action: 'quota_reset',
            details: { resources: resourcesToReset },
            performedBy: 'system',
            reason: body.reason,
        }, env);
        
        return new Response(JSON.stringify(authz), {
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
 * POST /authz/:customerId/quotas/increment
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
        
        const authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Authorization data not found for customer: ${customerId}`,
                code: 'AUTHZ_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const amount = body.amount || 1;
        
        if (authz.quotas[body.resource]) {
            authz.quotas[body.resource].current += amount;
            authz.metadata.updatedAt = new Date().toISOString();
            await saveCustomerAuthz(authz, env);
        }
        
        return new Response(JSON.stringify({
            success: true,
            quota: authz.quotas[body.resource] || null,
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
