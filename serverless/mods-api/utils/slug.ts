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
    auth: { userId: string; customerId: string | null; email?: string } | null
): Promise<ModMetadata | null> {
    // Check if user is super admin
    const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
    
    // Check global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            // Normalize modId to match how it was stored (with normalizeModId)
            const normalizedModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                // CRITICAL: Filter legacy mods that don't meet visibility/status requirements
                // Legacy mods without status field are treated as published
                if (!isAdmin) {
                    const modStatus = mod.status || 'published';
                    // For non-super users: ONLY public, published mods are allowed
                    // BUT: Authors can always see their own mods regardless of status
                    const isAuthor = mod.authorId === auth?.userId;
                    if ((mod.visibility !== 'public' || modStatus !== 'published') && !isAuthor) {
                        continue; // Skip this mod, don't return it
                    }
                }
                return mod;
            }
        }
    }
    
    // Check customer scope if authenticated (for private/unlisted mods)
    if (auth?.customerId) {
        const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
        const customerModsList = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
        
        if (customerModsList) {
            for (const modId of customerModsList) {
                // Normalize modId to match how it was stored (with normalizeModId)
                const normalizedModId = normalizeModId(modId);
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                if (mod && mod.slug === slug) {
                    // For customer-scoped mods, allow if user is author or super admin
                    if (!isAdmin && mod.authorId !== auth.userId) {
                        continue; // Skip - not the author and not admin
                    }
                    return mod;
                }
            }
        }
    }
    
    // CRITICAL: If not found and no auth (e.g., badges loading as images), search ALL customer scopes
    // This is needed because approved mods aren't in the public list yet
    if (!auth) {
        const customerListPrefix = 'customer_';
        let cursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
            
            for (const key of listResult.keys) {
                // Look for customer mod lists: customer_{id}_mods_list
                if (key.name.endsWith('_mods_list')) {
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const customerId = match ? match[1] : null;
                    
                    if (customerId) {
                        const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                        
                        if (customerModsList) {
                            for (const modId of customerModsList) {
                                const normalizedModId = normalizeModId(modId);
                                const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                
                                if (mod && mod.slug === slug) {
                                    // For public badges/images: only return public, approved/published mods
                                    const modVisibility = mod.visibility || 'public';
                                    const modStatus = mod.status || 'published';
                                    if (modVisibility === 'public' && (modStatus === 'published' || modStatus === 'approved')) {
                                        return mod;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
    }
    
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

