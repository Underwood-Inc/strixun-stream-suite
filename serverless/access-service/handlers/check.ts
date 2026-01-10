/**
 * Check Handlers
 * 
 * POST endpoints for checking permissions and quotas.
 * Core authorization decision-making logic.
 */

import type { Env, CheckPermissionRequest, CheckQuotaRequest } from '../types/authorization.js';
import { getCustomerAccess, listRoleDefinitions } from '../utils/access-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * Check if customer has a specific permission
 * Resolves permissions from roles + explicit permissions
 */
async function hasPermission(
    customerId: string,
    permission: string,
    env: Env
): Promise<{ allowed: boolean; reason?: string }> {
    const access = await getCustomerAccess(customerId, env);
    
    if (!access) {
        return { allowed: false, reason: 'No authorization data found' };
    }
    
    // Check for banned role (highest priority)
    if (access.roles.includes('banned')) {
        return { allowed: false, reason: 'User is banned' };
    }
    
    // Check explicit permissions first
    if (access.permissions.includes(permission)) {
        return { allowed: true };
    }
    
    // Check wildcard permission (super-admin)
    if (access.permissions.includes('*')) {
        return { allowed: true };
    }
    
    // Resolve permissions from roles
    const roleDefinitions = await listRoleDefinitions(env);
    const roleMap = new Map(roleDefinitions.map(r => [r.name, r]));
    
    for (const roleName of access.roles) {
        const role = roleMap.get(roleName);
        if (!role) continue;
        
        // Check wildcard permission in role
        if (role.permissions.includes('*')) {
            return { allowed: true };
        }
        
        // Check specific permission in role
        if (role.permissions.includes(permission)) {
            return { allowed: true };
        }
    }
    
    return { allowed: false, reason: 'Permission not granted' };
}

/**
 * POST /access/check-permission
 * Check if customer has specific permission
 */
export async function handleCheckPermission(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const body = await request.json() as CheckPermissionRequest;
        
        if (!body.customerId || !body.permission) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'customerId and permission are required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const result = await hasPermission(body.customerId, body.permission, env);
        
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[CheckPermission] Error:', error);
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
 * POST /access/check-quota
 * Check if customer has quota available for a resource
 */
export async function handleCheckQuota(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const body = await request.json() as CheckQuotaRequest;
        
        if (!body.customerId || !body.resource) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'customerId and resource are required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const access = await getCustomerAccess(body.customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                allowed: false,
                quota: {
                    limit: 0,
                    current: 0,
                    remaining: 0,
                    resetAt: new Date().toISOString(),
                },
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const quota = access.quotas[body.resource];
        
        if (!quota) {
            // No quota defined = unlimited
            return new Response(JSON.stringify({
                allowed: true,
                quota: {
                    limit: -1,
                    current: 0,
                    remaining: -1,
                    resetAt: new Date().toISOString(),
                },
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const amount = body.amount || 1;
        const remaining = quota.limit - quota.current;
        const allowed = remaining >= amount;
        
        return new Response(JSON.stringify({
            allowed,
            quota: {
                limit: quota.limit,
                current: quota.current,
                remaining,
                resetAt: quota.resetAt,
            },
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[CheckQuota] Error:', error);
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
