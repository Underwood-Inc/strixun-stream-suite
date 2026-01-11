/**
 * Dashboard Roles & Permissions Routes  
 * Access Service integration for role management
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { authenticateRequest, type RouteResult } from './auth.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    SERVICE_API_KEY?: string;
    [key: string]: any;
}

export async function handleRolesRoutes(
    path: string,
    request: Request,
    env: Env
): Promise<RouteResult | null> {
    if (path === '/admin/roles' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        
        if (!auth || !auth.customerId) {
            return { 
                response: new Response(JSON.stringify({ 
                    error: 'Authentication required',
                    code: 'AUTHENTICATION_REQUIRED'
                }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        
        // Service-to-service call to Access Service for authenticated user's roles
        const { createAccessClient } = await import('../../../shared/access-client.js');
        const accessClient = createAccessClient(env);
        const authorization = await accessClient.getCustomerAuthorization(auth.customerId);
        
        if (!authorization) {
            return {
                response: new Response(JSON.stringify({
                    error: 'Customer not found in Access Service',
                    code: 'CUSTOMER_NOT_FOUND'
                }), {
                    status: 404,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: auth.customerId
            };
        }
        
        return {
            response: new Response(JSON.stringify({ roles: authorization.roles }), {
                status: 200,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth.customerId
        };
    }

    return null;
}
