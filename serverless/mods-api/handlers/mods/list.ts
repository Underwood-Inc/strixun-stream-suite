/**
 * List mods handler
 * GET /mods
 * Supports filtering, pagination, and search
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { isSuperAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModListResponse } from '../../types/mod.js';
import type { AuthResult } from '../../utils/auth.js';

/**
 * Sort by date descending (newest first)
 */
function sortByUpdatedAtDesc(a: ModMetadata, b: ModMetadata): number {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    const aValid = !isNaN(aTime) ? aTime : 0;
    const bValid = !isNaN(bTime) ? bTime : 0;
    return bValid - aValid;
}

/**
 * Handle list mods request
 */
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
        const visibility = url.searchParams.get('visibility') || 'public'; // Default to public

        // Check if customer is super admin (once, not in loop)
        const isAdmin = auth?.customerId ? await isSuperAdmin(auth.customerId, auth.jwtToken, env) : false;

        // Get all mod IDs from global public list
        // This list contains ALL public mods regardless of customer
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        const globalModIds = globalListData || [];
        
        // Log for debugging - verify we're using local KV
        if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
            console.log('[ListMods] Local dev mode - using local KV storage:', {
                environment: env.ENVIRONMENT,
                globalListSize: globalModIds.length,
                globalListKey,
                note: 'If you see production mods here, clear local KV storage'
            });
        }

        // Get customer-specific mods if:
        // 1. User is super admin (needs to see everything), OR
        // 2. User is querying by authorId (needs to see their own mods, including pending ones in customer scope)
        let customerModIds: string[] = [];
        if (auth?.customerId && (isAdmin || authorId)) {
            const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
            const customerListData = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
            customerModIds = customerListData || [];
        }

        // Combine and deduplicate mod IDs - use modId directly, no normalization
        const allModIds = [...new Set([...globalModIds, ...customerModIds])];

        // Fetch all mod metadata and deduplicate by modId to prevent duplicates
        const mods: ModMetadata[] = [];
        const seenModIds = new Set<string>(); // Track modIds we've already added
        for (const modId of allModIds) {
            // Try to find mod in global scope first, then customer scope
            // Use modId directly - it already includes 'mod_' prefix
            let mod: ModMetadata | null = null;
            
            // Check global/public scope (no customer prefix)
            const globalModKey = modId;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found and authenticated, check customer scope
            if (!mod && auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, modId);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
            
            // If still not found, try other customer scopes (for public mods from other customers)
            if (!mod) {
                // Search through known customer prefixes (this is a fallback - ideally all public mods should be in global scope)
                // For now, we'll skip mods we can't find
                continue;
            }
            
            if (!mod) continue;
            
            // CRITICAL: Deduplicate by mod.modId to prevent same mod appearing twice
            // This can happen if mod exists in both global and customer lists
            // Use mod.modId directly - no normalization needed
            if (seenModIds.has(mod.modId)) {
                continue; // Skip if we've already added this mod
            }
            seenModIds.add(mod.modId);

            // Apply filters
            if (category && mod.category !== category) continue;
            if (search && !mod.title.toLowerCase().includes(search.toLowerCase()) && 
                !mod.description.toLowerCase().includes(search.toLowerCase()) &&
                !mod.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))) {
                continue;
            }
            if (authorId && mod.authorId !== authorId) continue;
            if (featured && !mod.featured) continue;
            
            // CRITICAL: When querying by authorId, always show the author's mods regardless of status/visibility
            // This allows users to see their own mods (including pending ones) in their dashboard
            const isAuthorQuery = !!authorId && mod.authorId === authorId;
            
            // CRITICAL: Enforce strict visibility and status filtering
            // When visibility='public', ALWAYS exclude non-approved mods (even for admins)
            // This ensures the public browsing page NEVER shows denied/pending/archived mods
            // EXCEPT: When querying by authorId, show all of the author's mods
            
            if (visibility === 'public' && !isAuthorQuery) {
                // For public browsing: ONLY approved mods with public visibility
                // This applies to BOTH regular users AND admins
                // Denied, pending, archived, draft, and changes_requested mods are excluded
                
                // Check visibility: MUST be 'public'
                // Legacy mods without visibility field are treated as public
                const modVisibility = mod.visibility || 'public';
                if (modVisibility !== 'public') {
                    // Only show private/unlisted mods to their author
                    if (mod.authorId !== auth?.customerId) {
                        continue;
                    }
                }
                
                // Check status: MUST be 'approved' (exclude all non-approved statuses)
                // This is CRITICAL - even admins should not see non-approved mods in public browsing
                // Only approved mods should appear in the public browse page
                // Legacy mods without status field are excluded (must be explicitly approved)
                if (!mod.status || mod.status !== 'approved') {
                    // Only show non-approved mods to their author (for profile pages)
                    if (mod.authorId !== auth?.customerId) {
                        continue;
                    }
                }
            } else {
                // For non-public visibility filters (e.g., 'all'), apply different rules
                if (!isAdmin) {
                    // For non-super users: apply visibility filter
                    // Legacy mods without visibility field are treated as public
                    const modVisibility = mod.visibility || 'public';
                    if (modVisibility !== 'public' && mod.authorId !== auth?.customerId) {
                        continue;
                    }
                    // Non-admins can only see approved mods or their own mods
                    // Legacy mods without status field are excluded (must be explicitly approved)
                    if (!mod.status || mod.status !== 'approved') {
                        if (mod.authorId !== auth?.customerId) {
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
        mods.sort(sortByUpdatedAtDesc);

        // CRITICAL: Ensure all mods have customerId (for data scoping)
        // Set customerId from auth context if missing (for legacy mods)
        // Only use auth.customerId if the current customer is the mod author
        const modsToSave: Array<{ mod: ModMetadata; modKey: string }> = [];
        for (const mod of mods) {
            if (!mod.customerId && auth?.customerId && mod.authorId === auth.customerId) {
                // Only set if we have auth context, mod is missing customerId, AND current customer is the author
                // This handles legacy mods that were created before customerId was required
                console.log('[ListMods] Setting missing customerId on legacy mod:', {
                    modId: mod.modId,
                    customerId: auth.customerId,
                    authorId: mod.authorId,
                    currentCustomerId: auth.customerId
                });
                mod.customerId = auth.customerId;
                
                // Determine the correct modKey to save to
                // Try customer scope first, then global scope
                const customerModKey = getCustomerKey(auth.customerId, mod.modId);
                const globalModKey = mod.modId;
                const existingMod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
                if (existingMod && existingMod.modId === mod.modId) {
                    // Mod exists in global scope, save to both customer and global
                    modsToSave.push({ mod, modKey: globalModKey });
                }
                modsToSave.push({ mod, modKey: customerModKey });
            }
        }
        
        // Persist customerId updates to KV (non-blocking)
        if (modsToSave.length > 0) {
            Promise.all(modsToSave.map(({ mod, modKey }) => 
                env.MODS_KV.put(modKey, JSON.stringify(mod))
            )).catch(error => {
                console.error('[ListMods] Failed to persist customerId updates:', error);
            });
        }

        // CRITICAL: Fetch display names dynamically from customer data
        // Customer is the primary data source for all customizable customer info
        // Fetch by customerIds - customer is the source of truth
        // IMPORTANT: This fetch is non-blocking - if customer-api is unavailable, we use stored values
        const uniqueCustomerIds = [...new Set(mods.map(mod => mod.customerId).filter((id): id is string => !!id))];
        let displayNames = new Map<string, string | null>();
        
        if (uniqueCustomerIds.length > 0) {
            try {
                const { fetchDisplayNamesByCustomerIds } = await import('@strixun/api-framework');
                
                // Add timeout to prevent hanging if customer-api is not running
                // Use Promise.race with a timeout promise
                // getCustomerApiUrl already handles undefined ENVIRONMENT by defaulting to localhost
                const fetchPromise = fetchDisplayNamesByCustomerIds(uniqueCustomerIds, env);
                const timeoutPromise = new Promise<Map<string, string | null>>((resolve) => {
                    setTimeout(() => {
                        console.warn('[ListMods] Display name fetch timed out after 3s, using stored values');
                        resolve(new Map());
                    }, 3000); // 3 second timeout - customer-api should respond quickly if running
                });
                
                displayNames = await Promise.race([fetchPromise, timeoutPromise]);
            } catch (error) {
                // If fetch fails (customer-api not running, network error, etc.), log but continue
                console.warn('[ListMods] Failed to fetch display names, using stored values:', 
                    error instanceof Error ? error.message : String(error));
                displayNames = new Map();
            }
        }
        
        // Map display names to mods - always use fetched value from customer data if available
        // This ensures we have the latest display names from the source of truth
        mods.forEach(mod => {
            const storedDisplayName = mod.authorDisplayName; // Preserve as fallback only
            const fetchedDisplayName = mod.customerId ? displayNames.get(mod.customerId) : null;
            // Always prefer fetched value from customer data - it's the source of truth
            // Fall back to stored value only if fetch failed (for backward compatibility)
            mod.authorDisplayName = fetchedDisplayName || storedDisplayName || null;
        });

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
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
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
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
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

