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
    // Check global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            const normalizedModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                return mod.modId;
            }
        }
    }
    
    // Check customer scope if authenticated
    if (auth?.customerId) {
        const customerListKey = getCustomerKey(auth.customerId, 'mods_list');
        const customerModsList = await env.MODS_KV.get(customerListKey, { type: 'json' }) as string[] | null;
        
        if (customerModsList) {
            for (const modId of customerModsList) {
                const normalizedModId = normalizeModId(modId);
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
                const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                if (mod && mod.slug === slug) {
                    return mod.modId;
                }
            }
        }
    }
    
    // Search all customer scopes (for cross-customer access)
    const customerListPrefix = 'customer_';
    let cursor: string | undefined;
    
    do {
        const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
        
        for (const key of listResult.keys) {
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
                                // CRITICAL: Slug resolver should only convert slug to modId
                                // Access control (visibility/status) should be enforced by handlers, not here
                                // This allows image endpoints (thumbnail, badge) to work even for pending mods
                                // when accessed by the author or when the mod becomes public
                                return mod.modId;
                            }
                        }
                    }
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

