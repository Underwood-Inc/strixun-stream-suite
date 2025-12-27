/**
 * Slug utilities for mod lookup
 */

import { getCustomerKey } from './customer.js';
import type { ModMetadata } from '../types/mod.js';

/**
 * Find mod by slug
 * Searches both global (public) and customer-scoped mods
 */
export async function findModBySlug(
    slug: string,
    env: Env,
    auth: { userId: string; customerId: string | null } | null
): Promise<ModMetadata | null> {
    // Check global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            const globalModKey = `mod_${modId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                return mod;
            }
        }
    }
    
    // Check customer scope if authenticated
    if (auth?.customerId) {
        const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
        const customerModsList = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
        
        if (customerModsList) {
            for (const modId of customerModsList) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                if (mod && mod.slug === slug) {
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

