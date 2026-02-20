/**
 * Dashboard Roles & Permissions Routes  
 * Access Service integration for role management
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
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
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }), 
                customerId: null 
            };
        }
        
        // Service-to-service call to Access Service - use SERVICE_API_KEY (same as login flow).
        // User is already authenticated by OTP Auth; we just need to fetch their roles from Access Service.
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
                    headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
                }),
                customerId: auth.customerId
            };
        }
        
        return {
            response: new Response(JSON.stringify({ roles: authorization.roles }), {
                status: 200,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: auth.customerId
        };
    }

    return null;
}
