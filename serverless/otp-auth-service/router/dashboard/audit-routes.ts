/**
 * Dashboard Audit Log Routes
 * Customer-scoped audit log access
 */

import { authenticateRequest, handleAdminRoute, type RouteResult } from './auth.js';
// @ts-ignore - JS handlers don't have type declarations
import * as adminHandlers from '../../handlers/admin.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

export async function handleAuditRoutes(
    path: string,
    request: Request,
    env: Env
): Promise<RouteResult | null> {
    if (path === '/admin/audit-logs' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        return handleAdminRoute(adminHandlers.handleGetAuditLogs, request, env, auth);
    }

    return null;
}
