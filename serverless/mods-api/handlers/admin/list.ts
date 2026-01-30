/**
 * Admin list handler
 * Lists all mods for admin triage
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import type { ModMetadata, ModListResponse } from '../../types/mod.js';

export async function handleListAllMods(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');

        // Get all mod IDs from visibility indexes
        const publicModIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
        
        // For admin, we need to scan for all mods including private
        // Get from all customer indexes
        const customerPrefix = 'idx:mods:by-customer:';
        let cursor: string | undefined;
        const allModIds = new Set<string>(publicModIds);
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerPrefix, cursor });
            for (const key of listResult.keys) {
                const ids = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                if (ids) {
                    ids.forEach(id => allModIds.add(id));
                }
            }
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);

        // Fetch all mods
        let mods = await getExistingEntities<ModMetadata>(env.MODS_KV, 'mods', 'mod', [...allModIds]);

        // Apply filters
        if (status) {
            mods = mods.filter(m => m.status === status);
        }
        if (category) {
            mods = mods.filter(m => m.category === category);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            mods = mods.filter(m => 
                m.title.toLowerCase().includes(searchLower) ||
                m.description.toLowerCase().includes(searchLower) ||
                m.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Sort by updatedAt descending
        mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // Fetch display names
        const uniqueCustomerIds = [...new Set(mods.map(m => m.customerId).filter(Boolean))] as string[];
        if (uniqueCustomerIds.length > 0) {
            const { fetchDisplayNamesByCustomerIds } = await import('@strixun/api-framework');
            const displayNames = await fetchDisplayNamesByCustomerIds(uniqueCustomerIds, env);
            mods.forEach(mod => {
                if (mod.customerId) {
                    const fetched = displayNames.get(mod.customerId);
                    if (fetched) mod.authorDisplayName = fetched;
                }
            });
        }

        // Paginate
        const total = mods.length;
        const paginatedMods = mods.slice((page - 1) * pageSize, page * pageSize);

        const response: ModListResponse = {
            mods: paginatedMods,
            total,
            page,
            pageSize
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders(request, env),
            },
        });
    } catch (error: any) {
        console.error('Admin list mods error:', error);
        const rfcError = createError(
            request, 500, 'Failed to List Mods',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
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

interface Env {
    MODS_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
