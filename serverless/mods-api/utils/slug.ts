/**
 * Slug utilities for mod lookup
 */

import { getCustomerKey, normalizeModId } from './customer.js';
import { isSuperAdminEmail } from './admin.js';
import type { ModMetadata } from '../types/mod.js';

/**
 * Find mod by slug
 * Searches both global (public) and customer-scoped mods
 * Enforces visibility/status filtering for non-super users
 */
export async function findModBySlug(
    slug: string,
    env: Env,
    auth: { customerId: string; jwtToken: string } | null
): Promise<ModMetadata | null> {
    // Check if user is super admin (SECURITY: lookup email by customerId)
    let isAdmin = false;
    if (auth?.customerId) {
        const { getCustomerEmail } = await import('./customer-email.js');
        const email = await getCustomerEmail(auth.customerId, env);
        isAdmin = email ? await isSuperAdminEmail(email, env) : false;
    }
    
    // Check global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    console.log('[findModBySlug] Checking global scope:', { slug, globalListCount: globalModsList?.length || 0 });
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            // Normalize modId to match how it was stored (with normalizeModId)
            const normalizedModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                console.log('[findModBySlug] Found mod in global scope:', { slug, modId: mod.modId, status: mod.status, visibility: mod.visibility, authorId: mod.authorId, authUserId: auth?.customerId });
                // CRITICAL: Filter legacy mods that don't meet visibility/status requirements
                // Legacy mods without status field are treated as published
                if (!isAdmin) {
                    const modStatus = mod.status || 'published';
                    // For non-super users: ONLY public, published/approved mods are allowed
                    // BUT: Authors can always see their own mods regardless of status
                    const isAuthor = mod.authorId === auth?.customerId;
                    const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
                    if ((mod.visibility !== 'public' || !isAllowedStatus) && !isAuthor) {
                        console.log('[findModBySlug] Mod found but filtered out (not public/approved and not author):', { slug, status: modStatus, visibility: mod.visibility, isAuthor });
                        continue; // Skip this mod, don't return it
                    }
                }
                console.log('[findModBySlug] Returning mod from global scope');
                return mod;
            }
        }
    } else {
        console.log('[findModBySlug] Global mods list is empty or null');
    }
    
    // Check customer scope if authenticated (for private/unlisted mods)
    if (auth?.customerId) {
        console.log('[findModBySlug] Checking auth customer scope:', { slug, customerId: auth.customerId });
        const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
        const customerModsList = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
        
        if (customerModsList) {
            console.log('[findModBySlug] Found customer mods list:', { customerId: auth.customerId, count: customerModsList.length });
            for (const modId of customerModsList) {
                // Normalize modId to match how it was stored (with normalizeModId)
                const normalizedModId = normalizeModId(modId);
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                if (mod && mod.slug === slug) {
                    console.log('[findModBySlug] Found mod in auth customer scope:', { slug, modId: mod.modId, status: mod.status, visibility: mod.visibility, authorId: mod.authorId, authUserId: auth.customerId });
                    // For customer-scoped mods, allow if user is author or super admin
                    if (!isAdmin && mod.authorId !== auth.customerId) {
                        console.log('[findModBySlug] Mod found but user is not author/admin, skipping');
                        continue; // Skip - not the author and not admin
                    }
                    console.log('[findModBySlug] Returning mod from auth customer scope');
                    return mod;
                }
            }
        } else {
            console.log('[findModBySlug] No customer mods list found for:', { customerId: auth.customerId });
        }
    }
    
    // CRITICAL: If not found and no auth (e.g., badges loading as images, or downloads without auth), search ALL customer scopes
    // This is needed because approved mods might not be in the public list yet, or mods might be in customer scopes
    if (!auth) {
        console.log('[findModBySlug] No auth provided, searching all customer scopes for slug:', slug);
        const customerListPrefix = 'customer_';
        let cursor: string | undefined;
        let searchedCustomers = 0;
        let checkedMods = 0;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
            
            for (const key of listResult.keys) {
                // Look for customer mod lists: customer_{id}_mods_list
                if (key.name.endsWith('_mods_list')) {
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const customerId = match ? match[1] : null;
                    
                    if (customerId) {
                        searchedCustomers++;
                        const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                        
                        if (customerModsList) {
                            for (const modId of customerModsList) {
                                checkedMods++;
                                const normalizedModId = normalizeModId(modId);
                                const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                
                                if (mod && mod.slug === slug) {
                                    console.log('[findModBySlug] Found mod in customer scope:', {
                                        slug,
                                        customerId,
                                        modId: mod.modId,
                                        status: mod.status,
                                        visibility: mod.visibility
                                    });
                                    
                                    // For public badges/images/downloads: only return public, approved/published mods
                                    const modVisibility = mod.visibility || 'public';
                                    const modStatus = mod.status || 'published';
                                    if (modVisibility === 'public' && (modStatus === 'published' || modStatus === 'approved')) {
                                        console.log('[findModBySlug] Returning mod (public and approved/published):', { slug, modId: mod.modId });
                                        return mod;
                                    } else {
                                        // Log why mod was filtered out (for debugging)
                                        console.log('[findModBySlug] Mod found but filtered out (public lookup):', {
                                            slug,
                                            status: modStatus,
                                            visibility: modVisibility,
                                            modId: mod.modId
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        console.log('[findModBySlug] Finished searching customer scopes:', { slug, searchedCustomers, checkedMods, found: false });
    }
    
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

