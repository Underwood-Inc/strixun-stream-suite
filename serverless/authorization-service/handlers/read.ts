/**
 * Read Handlers
 * 
 * GET endpoints for reading authorization data.
 * These are read-only and can be called by any authenticated service.
 */

import type { Env } from '../types/authorization.js';
import { getCustomerAuthz } from '../utils/authz-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * GET /authz/:customerId
 * Get full authorization data for a customer
 */
export async function handleGetAuthz(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
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
        
        return new Response(JSON.stringify(authz), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetAuthz] Error:', error);
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
 * GET /authz/:customerId/permissions
 * Get just permissions for a customer
 */
export async function handleGetPermissions(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
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
            permissions: authz.permissions,
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
 * GET /authz/:customerId/roles
 * Get just roles for a customer
 */
export async function handleGetRoles(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
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
            roles: authz.roles,
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
 * GET /authz/:customerId/quotas
 * Get just quotas for a customer
 */
export async function handleGetQuotas(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const authz = await getCustomerAuthz(customerId, env);
        
        if (!authz) {
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
            quotas: authz.quotas,
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
