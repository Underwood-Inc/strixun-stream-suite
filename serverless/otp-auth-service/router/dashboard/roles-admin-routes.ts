/**
 * Dashboard Roles Administration Routes
 * Super-admin endpoints for viewing all system roles and permissions
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { authenticateRequest, handleSuperAdminRoute, type RouteResult } from './auth.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    SERVICE_API_KEY?: string;
    ACCESS_SERVICE_URL?: string;
    [key: string]: any;
}

/**
 * Get all system roles (super-admin only)
 */
async function handleGetAllRoles(request: Request, env: Env): Promise<Response> {
    const accessUrl = env.ACCESS_SERVICE_URL || 'https://access.idling.app';
    const response = await fetch(`${accessUrl}/access/roles`, {
        headers: {
            'X-Service-Key': env.SERVICE_API_KEY || '',
            'Content-Type': 'application/json',
        },
    });
    
    if (!response.ok) {
        throw new Error(`Access Service returned ${response.status}`);
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

/**
 * Get all system permissions (super-admin only)
 */
async function handleGetAllPermissions(request: Request, env: Env): Promise<Response> {
    const accessUrl = env.ACCESS_SERVICE_URL || 'https://access.idling.app';
    const response = await fetch(`${accessUrl}/access/permissions`, {
        headers: {
            'X-Service-Key': env.SERVICE_API_KEY || '',
            'Content-Type': 'application/json',
        },
    });
    
    if (!response.ok) {
        throw new Error(`Access Service returned ${response.status}`);
    }
    
    const data = await response.json();
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

export async function handleRolesAdminRoutes(
    path: string,
    request: Request,
    env: Env
): Promise<RouteResult | null> {
    const auth = await authenticateRequest(request, env);

    if (path === '/admin/roles/all' && request.method === 'GET') {
        return handleSuperAdminRoute(handleGetAllRoles, request, env, auth);
    }

    if (path === '/admin/permissions/all' && request.method === 'GET') {
        return handleSuperAdminRoute(handleGetAllPermissions, request, env, auth);
    }

    return null;
}
