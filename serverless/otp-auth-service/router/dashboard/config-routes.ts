/**
 * Dashboard Configuration Routes
 * System configuration management
 */

import { authenticateRequest, handleAdminRoute, handleSuperAdminRoute, type RouteResult } from './auth.js';
// @ts-ignore - JS handlers don't have type declarations
import * as adminHandlers from '../../handlers/admin.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

export async function handleConfigRoutes(
    path: string,
    request: Request,
    env: Env
): Promise<RouteResult | null> {
    const auth = await authenticateRequest(request, env);

    if (path === '/admin/config' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetConfig, request, env, auth);
    }
    
    if (path === '/admin/config' && request.method === 'PUT') {
        return handleSuperAdminRoute(adminHandlers.handleUpdateConfig, request, env, auth);
    }
    
    if (path === '/admin/config/email' && request.method === 'PUT') {
        return handleSuperAdminRoute(adminHandlers.handleUpdateEmailConfig, request, env, auth);
    }
    
    if (path === '/admin/onboarding' && request.method === 'GET') {
        return handleAdminRoute(adminHandlers.handleGetOnboarding, request, env, auth);
    }
    
    if (path === '/admin/onboarding' && request.method === 'PUT') {
        return handleAdminRoute(adminHandlers.handleUpdateOnboarding, request, env, auth);
    }
    
    if (path === '/admin/onboarding/test-otp' && request.method === 'POST') {
        return handleAdminRoute(adminHandlers.handleTestOTP, request, env, auth);
    }

    return null;
}
