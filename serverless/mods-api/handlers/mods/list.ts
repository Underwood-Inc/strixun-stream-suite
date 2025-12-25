/**
 * List mods handler
 * GET /mods
 * Supports filtering, pagination, and search
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata, ModListResponse } from '../../types/mod.js';

/**
 * Handle list mods request
 */
export async function handleListMods(
    request: Request,
    env: Env,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');
        const authorId = url.searchParams.get('authorId');
        const featured = url.searchParams.get('featured') === 'true';
        const visibility = url.searchParams.get('visibility') || 'public'; // Default to public

        // Build list key
        const listKey = getCustomerKey(auth?.customerId || null, 'mods_list');
        
        // Get all mod IDs from list (stored as JSON array)
        const listData = await env.MODS_KV.get(listKey, { type: 'json' }) as string[] | null;
        const modIds = listData || [];

        // Fetch all mod metadata
        const mods: ModMetadata[] = [];
        for (const modId of modIds) {
            const modKey = getCustomerKey(auth?.customerId || null, `mod_${modId}`);
            const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
            
            if (!mod) continue;

            // Apply filters
            if (category && mod.category !== category) continue;
            if (search && !mod.title.toLowerCase().includes(search.toLowerCase()) && 
                !mod.description.toLowerCase().includes(search.toLowerCase()) &&
                !mod.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))) {
                continue;
            }
            if (authorId && mod.authorId !== authorId) continue;
            if (featured && !mod.featured) continue;
            
            // Visibility filter
            if (visibility === 'public' && mod.visibility !== 'public') {
                // Only show private/unlisted mods to their author
                if (mod.authorId !== auth?.userId) continue;
            } else if (visibility === 'all' && mod.visibility !== 'public' && mod.authorId !== auth?.userId) {
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
        console.error('List mods error:', error);
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
    [key: string]: any;
}

