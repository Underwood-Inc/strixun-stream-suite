/**
 * Dashboard Analytics Routes
 * Customer-scoped analytics endpoints
 */

import { authenticateRequest, handleAdminRoute, type RouteResult } from './auth.js';
// @ts-ignore - JS handlers don't have type declarations
import * as adminHandlers from '../../handlers/admin.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

export async function handleAnalyticsRoutes(
    path: string,
    request: Request,
    env: Env
): Promise<RouteResult | null> {
    const auth = await authenticateRequest(request, env);

    if (path === '/admin/analytics' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetAnalytics, request, env, auth);
    }
    
    if (path === '/admin/analytics/realtime' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetRealtimeAnalytics, request, env, auth);
    }
    
    if (path === '/admin/analytics/errors' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetErrorAnalytics, request, env, auth);
    }
    
    if (path === '/admin/analytics/email' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetEmailAnalytics, request, env, auth);
    }

    return null;
}
