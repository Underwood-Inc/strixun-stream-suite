/**
 * Audit Handlers
 * 
 * Endpoints for retrieving audit logs.
 */

import type { Env } from '../types/authorization.js';
import { getAuditLogs } from '../utils/access-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * GET /access/:customerId/audit-log
 * Get audit log for a customer
 */
export async function handleGetAuditLog(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        
        const logs = await getAuditLogs(customerId, env, limit);
        
        return new Response(JSON.stringify({
            logs,
            total: logs.length,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[GetAuditLog] Error:', error);
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
