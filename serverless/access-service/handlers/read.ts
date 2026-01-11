/**
 * Read Handlers
 * 
 * GET endpoints for reading authorization data.
 * These are read-only and can be called by any authenticated service.
 */

import type { Env } from '../types/authorization.js';
import { getCustomerAccess } from '../utils/access-kv.js';
import { createCORSHeaders } from '../utils/cors.js';

/**
 * GET /access/:customerId
 * Get full authorization data for a customer
 */
export async function handleGetAccess(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
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
        
        return new Response(JSON.stringify(access), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetAccess] Error:', error);
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
 * GET /access/:customerId/permissions
 * Get just permissions for a customer
 */
export async function handleGetPermissions(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                permissions: [],
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        return new Response(JSON.stringify({
            permissions: access.permissions,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetPermissions] Error:', error);
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
 * GET /access/:customerId/roles
 * Get just roles for a customer
 */
export async function handleGetRoles(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                roles: [],
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        return new Response(JSON.stringify({
            roles: access.roles,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetRoles] Error:', error);
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
 * GET /access/:customerId/quotas
 * Get just quotas for a customer
 */
export async function handleGetQuotas(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const access = await getCustomerAccess(customerId, env);
        
        if (!access) {
            return new Response(JSON.stringify({
                quotas: {},
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        return new Response(JSON.stringify({
            quotas: access.quotas,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetQuotas] Error:', error);
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
