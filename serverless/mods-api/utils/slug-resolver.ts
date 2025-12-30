/**
 * Slug resolver utility
 * Converts slugs to modIds for URL routing
 * CRITICAL: Slug is for URL/UI only - all data lookups must use modId
 */

import { getCustomerKey, normalizeModId } from './customer.js';
import type { ModMetadata } from '../types/mod.js';

/**
 * Resolve slug to modId
 * This is ONLY for URL routing - returns modId which should be used for all data lookups
 * @param slug - The slug from the URL
 * @param env - Environment with KV access
 * @param auth - Optional auth for customer scope access
 * @returns The modId if found, null otherwise
 */
export async function resolveSlugToModId(
    slug: string,
    env: Env,
    auth: { userId: string; customerId: string | null; email?: string } | null
): Promise<string | null> {
    console.log('[SlugResolver] Resolving slug to modId:', { slug, hasAuth: !!auth, customerId: auth?.customerId });
    
    // Check global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        console.log('[SlugResolver] Checking global public scope:', { listSize: globalModsList.length });
        for (const modId of globalModsList) {
            const normalizedModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                console.log('[SlugResolver] Found in global public scope:', { modId: mod.modId, slug: mod.slug });
                return mod.modId;
            }
        }
    }
    
    // Check global mods_list (for mods with null customerId)
    const globalModsListKey = 'mods_list';
    const globalModsListNull = await env.MODS_KV.get(globalModsListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsListNull) {
        console.log('[SlugResolver] Checking global mods_list (null customerId):', { listSize: globalModsListNull.length });
        for (const modId of globalModsListNull) {
            const normalizedModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                console.log('[SlugResolver] Found in global mods_list:', { modId: mod.modId, slug: mod.slug });
                return mod.modId;
            }
        }
    }
    
    // Check customer scope if authenticated
    if (auth?.customerId) {
        const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
        const customerModsList = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
        
        if (customerModsList) {
            console.log('[SlugResolver] Checking authenticated customer scope:', { customerId: auth.customerId, listSize: customerModsList.length });
            for (const modId of customerModsList) {
                const normalizedModId = normalizeModId(modId);
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                if (mod && mod.slug === slug) {
                    console.log('[SlugResolver] Found in authenticated customer scope:', { modId: mod.modId, slug: mod.slug });
                    return mod.modId;
                }
            }
        } else {
            console.log('[SlugResolver] No mods_list found for authenticated customer:', { customerId: auth.customerId });
        }
    }
    
    // Search all customer scopes (for cross-customer access)
    // CRITICAL: This must work for unauthenticated requests (badge/thumbnail images)
    console.log('[SlugResolver] Searching all customer scopes...');
    const customerListPrefix = 'customer_';
    let cursor: string | undefined;
    let searchedLists = 0;
    let searchedMods = 0;
    
    do {
        const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
        
        for (const key of listResult.keys) {
            // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
            if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                searchedLists++;
                // Extract customerId from key name - handle both _ and / separators
                // CRITICAL: Customer IDs can contain underscores (e.g., cust_0ab4c4434c48)
                // Pattern: customer_{customerId}_mods_list or customer_{customerId}/mods_list
                // Match everything between "customer_" and the final "_mods_list" or "/mods_list"
                let customerId: string | null = null;
                if (key.name.endsWith('_mods_list')) {
                    // Remove "customer_" prefix and "_mods_list" suffix
                    const match = key.name.match(/^customer_(.+)_mods_list$/);
                    customerId = match ? match[1] : null;
                } else if (key.name.endsWith('/mods_list')) {
                    // Remove "customer_" prefix and "/mods_list" suffix
                    const match = key.name.match(/^customer_(.+)\/mods_list$/);
                    customerId = match ? match[1] : null;
                }
                
                if (customerId) {
                    const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                    
                    // Debug logging to understand why list might be empty
                    console.log('[SlugResolver] Retrieved customer list:', { 
                        customerId, 
                        key: key.name, 
                        hasList: !!customerModsList,
                        isArray: Array.isArray(customerModsList),
                        listType: typeof customerModsList,
                        listLength: customerModsList?.length ?? 0,
                        listValue: customerModsList ? (Array.isArray(customerModsList) ? `[${customerModsList.length} items]` : String(customerModsList).substring(0, 100)) : 'null'
                    });
                    
                    if (customerModsList && Array.isArray(customerModsList) && customerModsList.length > 0) {
                        console.log('[SlugResolver] Checking customer list:', { customerId, key: key.name, modCount: customerModsList.length });
                        searchedMods += customerModsList.length;
                        
                        for (const modId of customerModsList) {
                            try {
                                const normalizedModId = normalizeModId(modId);
                                const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                
                                if (mod && mod.slug === slug) {
                                    console.log('[SlugResolver] Found in customer scope:', { modId: mod.modId, slug: mod.slug, customerId, key: key.name });
                                    // CRITICAL: Slug resolver should only convert slug to modId
                                    // Access control (visibility/status) should be enforced by handlers, not here
                                    // This allows image endpoints (thumbnail, badge) to work even for pending mods
                                    // when accessed by the author or when the mod becomes public
                                    return mod.modId;
                                }
                            } catch (error) {
                                // Skip invalid mod entries
                                console.warn('[SlugResolver] Error checking mod:', { modId, error: error instanceof Error ? error.message : String(error) });
                                continue;
                            }
                        }
                    } else {
                        console.log('[SlugResolver] Customer list is empty or invalid:', { customerId, key: key.name, hasList: !!customerModsList, isArray: Array.isArray(customerModsList) });
                    }
                } else {
                    console.warn('[SlugResolver] Could not extract customerId from key:', { key: key.name });
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    console.log('[SlugResolver] Slug not found:', { slug, searchedLists, searchedMods });
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

