/**
 * List mods handler
 * GET /mods
 * Supports filtering, pagination, and search
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
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

        // Check if user is super admin (once, not in loop)
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;

        // Get all mod IDs from global public list
        // This list contains ALL public mods regardless of customer
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        const globalModIds = globalListData || [];

        // Only get customer-specific mods if user is super admin
        // Super admins need to see everything, regular users only see public mods
        let customerModIds: string[] = [];
        if (isAdmin && auth?.customerId) {
            const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
            const customerListData = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
            customerModIds = customerListData || [];
        }

        // Combine and deduplicate mod IDs
        const allModIds = [...new Set([...globalModIds, ...customerModIds])];

        // Fetch all mod metadata
        const mods: ModMetadata[] = [];
        for (const modId of allModIds) {
            // Try to find mod in global scope first, then customer scope
            let mod: ModMetadata | null = null;
            
            // Check global/public scope (no customer prefix)
            const globalModKey = `mod_${modId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found and authenticated, check customer scope
            if (!mod && auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
            
            // If still not found, try other customer scopes (for public mods from other customers)
            if (!mod) {
                // Search through known customer prefixes (this is a fallback - ideally all public mods should be in global scope)
                // For now, we'll skip mods we can't find
                continue;
            }
            
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
            
            // CRITICAL: Enforce strict visibility and status filtering
            // Only super admins can bypass these checks
            if (!isAdmin) {
                // For non-super users: ONLY public, published mods are allowed
                // Legacy mods without proper fields are filtered out
                
                // Check visibility: MUST be 'public'
                if (mod.visibility !== 'public') {
                    // Only show private/unlisted mods to their author (if visibility filter allows)
                    if (visibility === 'public' || mod.authorId !== auth?.userId) {
                        continue;
                    }
                }
                
                // Check status: MUST be 'published'
                // Legacy mods without status field are filtered out (undefined !== 'published')
                if (mod.status !== 'published') {
                    // Only show non-published mods to their author (if visibility filter allows)
                    const isAuthor = mod.authorId === auth?.userId;
                    if (!isAuthor || visibility === 'public') {
                        continue;
                    }
                }
            } else {
                // Super admins: apply visibility filter but allow all statuses
                if (visibility === 'public' && mod.visibility !== 'public') {
                    // Only show private/unlisted mods to their author
                    if (mod.authorId !== auth?.userId) continue;
                } else if (visibility === 'all' && mod.visibility !== 'public' && mod.authorId !== auth?.userId) {
                    continue;
                }
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

