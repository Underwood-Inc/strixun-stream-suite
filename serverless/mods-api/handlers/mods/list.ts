/**
 * List mods handler
 * GET /mods
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import { isSuperAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModListResponse } from '../../types/mod.js';
import type { AuthResult } from '../../utils/auth.js';

function sortByUpdatedAtDesc(a: ModMetadata, b: ModMetadata): number {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
}

export async function handleListMods(
    request: Request,
    env: Env,
    auth: AuthResult | null
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');
        const authorId = url.searchParams.get('authorId');
        const featured = url.searchParams.get('featured') === 'true';
        const visibility = url.searchParams.get('visibility') || 'public';

        const isAdmin = auth?.customerId ? await isSuperAdmin(auth.customerId, auth.jwtToken, env) : false;

        // Get mod IDs from appropriate index
        let modIds: string[] = [];
        
        if (authorId) {
            // Get mods for specific author
            modIds = await indexGet(env.MODS_KV, 'mods', 'by-customer', authorId);
        } else if (visibility === 'public') {
            // Get public mods
            modIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
        } else if (isAdmin) {
            // Admin can see all - combine public and customer mods
            modIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
            if (auth?.customerId) {
                const customerMods = await indexGet(env.MODS_KV, 'mods', 'by-customer', auth.customerId);
                modIds = [...new Set([...modIds, ...customerMods])];
            }
        } else if (auth?.customerId) {
            // Authenticated user sees public + their own
            const publicMods = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
            const customerMods = await indexGet(env.MODS_KV, 'mods', 'by-customer', auth.customerId);
            modIds = [...new Set([...publicMods, ...customerMods])];
        } else {
            // Unauthenticated sees only public
            modIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
        }

        // Fetch all mods
        let mods = await getExistingEntities<ModMetadata>(env.MODS_KV, 'mods', 'mod', modIds);

        // Apply filters
        mods = mods.filter(mod => {
            if (category && mod.category !== category) return false;
            if (featured && !mod.featured) return false;
            
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesTitle = mod.title.toLowerCase().includes(searchLower);
                const matchesDesc = mod.description.toLowerCase().includes(searchLower);
                const matchesTags = mod.tags.some(tag => tag.toLowerCase().includes(searchLower));
                if (!matchesTitle && !matchesDesc && !matchesTags) return false;
            }
            
            // Visibility/status filtering
            const isAuthorQuery = authorId && mod.authorId === authorId;
            if (!isAuthorQuery && !isAdmin) {
                const modVisibility = mod.visibility || 'public';
                const modStatus = mod.status || 'published';
                
                if (modVisibility !== 'public' && mod.authorId !== auth?.customerId) {
                    return false;
                }
                if (modStatus !== 'approved' && mod.authorId !== auth?.customerId) {
                    return false;
                }
            }
            
            return true;
        });

        // Sort by updatedAt (newest first)
        mods.sort(sortByUpdatedAtDesc);

        // Fetch display names
        const uniqueCustomerIds = [...new Set(mods.map(m => m.customerId).filter(Boolean))] as string[];
        if (uniqueCustomerIds.length > 0) {
            try {
                const { fetchDisplayNamesByCustomerIds } = await import('@strixun/api-framework');
                const displayNames = await Promise.race([
                    fetchDisplayNamesByCustomerIds(uniqueCustomerIds, env),
                    new Promise<Map<string, string | null>>(resolve => 
                        setTimeout(() => resolve(new Map()), 3000)
                    ),
                ]);
                
                mods.forEach(mod => {
                    if (mod.customerId) {
                        const fetched = displayNames.get(mod.customerId);
                        if (fetched) mod.authorDisplayName = fetched;
                    }
                });
            } catch {
                // Use stored displayNames
            }
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
                'Cache-Control': 'no-store',
                ...corsHeaders(request, env),
            },
        });
    } catch (error: any) {
        console.error('List mods error:', error);
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
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}

interface Env {
    MODS_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
