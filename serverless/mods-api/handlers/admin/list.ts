/**
 * Admin list handler
 * Lists all mods for admin triage (includes all statuses)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
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
        // CRITICAL: Admin needs to see ALL mods across ALL customer scopes, not just their own
        const allModIds = new Set<string>();

        // Get global public list FIRST
        // CRITICAL: Mods in the global list are approved/published public mods
        // These should NOT be collected again from customer lists to prevent duplicates
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        const globalModIdsSet = new Set<string>();
        if (globalListData) {
            globalListData.forEach(id => {
                allModIds.add(id);
                globalModIdsSet.add(id);
            });
        }

        // Get mods from ALL customer scopes (admin needs to see everything)
        // CRITICAL: Only collect mod IDs from customer lists that are NOT already in the global list
        // This prevents duplicates - approved mods are in global list, so skip them from customer lists
        // Use KV.list() to find all customer mod lists
        // Store modId -> customerId mapping for efficient lookup
        const modIdToCustomerId = new Map<string, string | null>();
        const customerListPrefix = 'customer_';
        let cursor: string | undefined;
        let totalCustomerLists = 0;
        let totalModIdsFromCustomers = 0;
        let skippedDuplicates = 0;
        
        // CRITICAL: Normalize modIds in global list for comparison
        // Global list stores normalized modIds (without mod_ prefix)
        // Customer lists may store modIds with or without prefix
        // normalizeModId is already imported at the top of the file
        const normalizedGlobalModIdsSet = new Set<string>();
        globalModIdsSet.forEach(id => {
            normalizedGlobalModIdsSet.add(normalizeModId(id));
        });
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
            console.log('[AdminList] KV.list() returned', listResult.keys.length, 'keys');
            
            for (const key of listResult.keys) {
                // Look for keys matching pattern: customer_{id}_mods_list
                if (key.name.endsWith('_mods_list')) {
                    totalCustomerLists++;
                    // Extract customerId from key name: customer_{id}_mods_list
                    // Handle both patterns: customer_{id}_mods_list and customer_{id}/mods_list
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const customerId = match ? match[1] : null;
                    console.log('[AdminList] Found customer list:', { key: key.name, customerId });
                    
                    const customerListData = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                    if (customerListData && Array.isArray(customerListData)) {
                        console.log('[AdminList] Customer list has', customerListData.length, 'mods');
                        customerListData.forEach(id => {
                            // CRITICAL: Normalize modId before checking for duplicates
                            // Global list stores normalized modIds, so we must normalize customer list modIds too
                            const normalizedId = normalizeModId(id);
                            if (normalizedGlobalModIdsSet.has(normalizedId)) {
                                skippedDuplicates++;
                                return; // Skip this mod ID - it's already in global list
                            }
                            
                            allModIds.add(id);
                            totalModIdsFromCustomers++;
                            // Store mapping for efficient lookup
                            if (customerId) {
                                modIdToCustomerId.set(id, customerId);
                            }
                        });
                    }
                }
            }
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
        
        console.log('[AdminList] Collected mod IDs:', {
            fromGlobal: globalListData?.length || 0,
            fromCustomers: totalModIdsFromCustomers,
            skippedDuplicates,
            totalCustomerLists,
            totalUniqueModIds: allModIds.size
        });

        // Fetch all mod metadata
        // CRITICAL: Search across ALL customer scopes, not just admin's customerId
        // Since we've already prevented duplicate mod IDs during collection, we don't need additional deduplication
        const mods: ModMetadata[] = [];
        
        for (const modId of allModIds) {
            // Normalize modId (strip mod_ prefix if present)
            // normalizeModId is already imported above at line 59
            const normalizedModId = normalizeModId(modId);
            
            // Try to find mod in global scope first (for approved/published public mods)
            let mod: ModMetadata | null = null;
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found in global scope, try the customer scope we found during list collection
            if (!mod) {
                const customerId = modIdToCustomerId.get(modId);
                if (customerId) {
                    const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                    mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                }
            }
            
            // Fallback: if still not found, search all customer scopes (shouldn't happen, but safety net)
            if (!mod) {
                const customerModPrefix = 'customer_';
                let cursor: string | undefined;
                let found = false;
                do {
                    const listResult = await env.MODS_KV.list({ prefix: customerModPrefix, cursor });
                    for (const key of listResult.keys) {
                        // Look for keys matching pattern: customer_*_mod_{normalizedModId}
                        if (key.name.endsWith(`_mod_${normalizedModId}`)) {
                            mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) break;
                    cursor = listResult.listComplete ? undefined : listResult.cursor;
                } while (cursor && !found);
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

        // CRITICAL: Fetch display names from customer data
        // Customer is the primary data source for all customizable user info
        // Fetch by customerIds (not userIds) - customer is the source of truth
        const uniqueCustomerIds = [...new Set(mods.map(mod => mod.customerId).filter((id): id is string => !!id))];
        console.log('[AdminList] Fetching display names for', uniqueCustomerIds.length, 'unique customers');
        
        const { fetchDisplayNamesByCustomerIds } = await import('@strixun/customer-lookup');
        const displayNames = await fetchDisplayNamesByCustomerIds(uniqueCustomerIds, env);
        
        console.log('[AdminList] Fetched display names from customer data:', {
            requested: uniqueCustomerIds.length,
            fetched: displayNames.size,
            displayNamesMap: Array.from(displayNames.entries()).slice(0, 5) // Log first 5 for debugging
        });
        
        // Map display names to mods (use fetched displayName from customer data if available, otherwise keep stored one)
        mods.forEach(mod => {
            const storedDisplayName = mod.authorDisplayName; // Preserve stored value
            const fetchedDisplayName = mod.customerId ? displayNames.get(mod.customerId) : null;
            // Always prefer fetched value from customer data - it's the source of truth
            // Fall back to stored value only if fetch failed (for backward compatibility)
            mod.authorDisplayName = fetchedDisplayName || storedDisplayName || null;
            
            // Log if display name is still null after fetch
            if (!mod.authorDisplayName && mod.customerId) {
                console.warn('[AdminList] No display name found for customerId:', {
                    customerId: mod.customerId,
                    authorId: mod.authorId,
                    storedDisplayName,
                    fetchedDisplayName,
                    hasFetched: displayNames.has(mod.customerId)
                });
            }
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

