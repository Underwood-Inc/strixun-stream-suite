/**
 * Admin customer mods handlers
 * GET /admin/customers/:customerId/mods
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import type { ModMetadata } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

export async function handleGetCustomerMods(
    request: Request,
    env: Env,
    customerId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);

        // Get all mod IDs for this customer
        const modIds = await indexGet(env.MODS_KV, 'mods', 'by-customer', customerId);

        // Fetch all mods
        const mods = await getExistingEntities<ModMetadata>(env.MODS_KV, 'mods', 'mod', modIds);

        // Sort by updatedAt descending
        mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // Paginate
        const total = mods.length;
        const paginatedMods = mods.slice((page - 1) * pageSize, page * pageSize);

        const response = {
            mods: paginatedMods,
            total,
            page,
            pageSize,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Admin get customer mods error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'Failed to get customer mods');
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
        });
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}
