/**
 * Admin list handler
 * Lists all mods for admin triage (includes all statuses)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata, ModListResponse } from '../../types/mod.js';

/**
 * Handle list all mods request (admin only)
 */
export async function handleListAllMods(
    request: Request,
    env: Env,
    auth: { userId: string; customerId: string | null }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        const status = url.searchParams.get('status'); // Filter by status
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');

        // Get all mod IDs from all sources
        const allModIds = new Set<string>();

        // Get global public list
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        if (globalListData) {
            globalListData.forEach(id => allModIds.add(id));
        }

        // Get customer-specific mods
        if (auth.customerId) {
            const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
            const customerListData = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
            if (customerListData) {
                customerListData.forEach(id => allModIds.add(id));
            }
        }

        // Fetch all mod metadata
        const mods: ModMetadata[] = [];
        for (const modId of allModIds) {
            // Try to find mod in global scope first, then customer scope
            let mod: ModMetadata | null = null;
            
            const globalModKey = `mod_${modId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            if (!mod && auth.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
            
            if (!mod) continue;

            // Apply filters
            if (status && mod.status !== status) continue;
            if (category && mod.category !== category) continue;
            if (search && !mod.title.toLowerCase().includes(search.toLowerCase()) && 
                !mod.description.toLowerCase().includes(search.toLowerCase()) &&
                !mod.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))) {
                continue;
            }

            mods.push(mod);
        }

        // Sort by updatedAt (newest first)
        mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // Paginate
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedMods = mods.slice(start, end);

        const response: ModListResponse = {
            mods: paginatedMods,
            total: mods.length,
            page,
            pageSize
        };

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin list mods error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Mods',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing mods'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

