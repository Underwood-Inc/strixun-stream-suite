/**
 * Definition Handlers
 * 
 * Endpoints for managing role and permission definitions.
 * Admin-only endpoints.
 */

import type { Env, RoleDefinition, PermissionDefinition } from '../types/authorization.js';
import { 
    listRoleDefinitions, 
    getRoleDefinition, 
    saveRoleDefinition,
    listPermissionDefinitions,
} from '../utils/authz-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * GET /authz/roles
 * List all role definitions
 */
export async function handleListRoles(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const roles = await listRoleDefinitions(env);
        
        return new Response(JSON.stringify({ roles }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[ListRoles] Error:', error);
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
 * GET /authz/roles/:roleName
 * Get specific role definition
 */
export async function handleGetRole(
    request: Request,
    env: Env,
    roleName: string
): Promise<Response> {
    try {
        const role = await getRoleDefinition(roleName, env);
        
        if (!role) {
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Role not found: ${roleName}`,
                code: 'ROLE_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        return new Response(JSON.stringify(role), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetRole] Error:', error);
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
 * PUT /authz/roles/:roleName
 * Create or update role definition
 */
export async function handleSaveRole(
    request: Request,
    env: Env,
    roleName: string
): Promise<Response> {
    try {
        const body = await request.json() as Omit<RoleDefinition, 'name'>;
        
        if (!body.displayName || !body.description || !body.permissions || typeof body.priority !== 'number') {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'displayName, description, permissions, and priority are required',
                code: 'INVALID_REQUEST',
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        const role: RoleDefinition = {
            name: roleName,
            displayName: body.displayName,
            description: body.description,
            permissions: body.permissions,
            defaultQuotas: body.defaultQuotas,
            priority: body.priority,
        };
        
        await saveRoleDefinition(role, env);
        
        return new Response(JSON.stringify(role), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[SaveRole] Error:', error);
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
 * GET /authz/permissions
 * List all permission definitions
 */
export async function handleListPermissions(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const permissions = await listPermissionDefinitions(env);
        
        return new Response(JSON.stringify({ permissions }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[ListPermissions] Error:', error);
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
