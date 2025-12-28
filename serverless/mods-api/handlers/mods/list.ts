/**
 * List mods handler
 * GET /mods
 * Supports filtering, pagination, and search
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
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

        // Get customer-specific mods if:
        // 1. User is super admin (needs to see everything), OR
        // 2. User is querying by authorId (needs to see their own mods, including pending ones in customer scope)
        let customerModIds: string[] = [];
        if (auth?.customerId && (isAdmin || authorId)) {
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
            
            // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
            const normalizedModId = normalizeModId(modId);
            
            // Check global/public scope (no customer prefix)
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found and authenticated, check customer scope
            if (!mod && auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
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
            // When visibility='public', ALWAYS exclude non-approved mods (even for admins)
            // This ensures the public browsing page NEVER shows denied/pending/archived mods
            
            if (visibility === 'public') {
                // For public browsing: ONLY approved mods with public visibility
                // This applies to BOTH regular users AND admins
                // Denied, pending, archived, draft, and changes_requested mods are excluded
                
                // Check visibility: MUST be 'public'
                // Legacy mods without visibility field are treated as public
                const modVisibility = mod.visibility || 'public';
                if (modVisibility !== 'public') {
                    // Only show private/unlisted mods to their author
                    if (mod.authorId !== auth?.userId) {
                        continue;
                    }
                }
                
                // Check status: MUST be 'approved' (exclude all non-approved statuses)
                // This is CRITICAL - even admins should not see non-approved mods in public browsing
                // Only approved mods should appear in the public browse page
                // Legacy mods without status field are excluded (must be explicitly approved)
                if (!mod.status || mod.status !== 'approved') {
                    // Only show non-approved mods to their author (for profile pages)
                    if (mod.authorId !== auth?.userId) {
                        continue;
                    }
                }
            } else {
                // For non-public visibility filters (e.g., 'all'), apply different rules
                if (!isAdmin) {
                    // For non-super users: apply visibility filter
                    // Legacy mods without visibility field are treated as public
                    const modVisibility = mod.visibility || 'public';
                    if (modVisibility !== 'public' && mod.authorId !== auth?.userId) {
                        continue;
                    }
                    // Non-admins can only see approved mods or their own mods
                    // Legacy mods without status field are excluded (must be explicitly approved)
                    if (!mod.status || mod.status !== 'approved') {
                        if (mod.authorId !== auth?.userId) {
                            continue;
                        }
                    }
                } else {
                    // Super admins with visibility='all' can see everything
                    // (This is for admin management pages, not public browsing)
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

