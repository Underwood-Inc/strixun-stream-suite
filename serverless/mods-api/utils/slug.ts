/**
 * Slug utilities for mod lookup
 */

import { getCustomerKey } from './customer.js';
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
            const globalModKey = `mod_${modId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                // CRITICAL: Filter legacy mods that don't meet visibility/status requirements
                // Legacy mods without status field are treated as published
                if (!isAdmin) {
                    const modStatus = mod.status || 'published';
                    // For non-super users: ONLY public, published mods are allowed
                    if (mod.visibility !== 'public' || modStatus !== 'published') {
                        // Only allow if user is the author
                        if (mod.authorId !== auth?.userId) {
                            continue; // Skip this mod, don't return it
                        }
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
                const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
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
    
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

