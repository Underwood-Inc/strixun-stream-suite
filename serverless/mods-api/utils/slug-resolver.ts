/**
 * Slug resolver utility
 * Converts slugs to modIds for URL routing using slug index
 * CRITICAL: Slug is for URL/UI only - all data lookups must use modId
 * Both slug and modId are unique index keys
 */

import { getCustomerKey } from './customer.js';

/**
 * Resolve slug to modId using slug index
 * This is ONLY for URL routing - returns modId which should be used for all data lookups
 * Uses direct index lookup for O(1) performance and exact matches only
 * @param slug - The slug from the URL
 * @param env - Environment with KV access
 * @param auth - Optional auth for customer scope access
 * @returns The modId if found, null otherwise
 */
export async function resolveSlugToModId(
    slug: string,
    env: Env,
    auth: { customerId: string; customerId: string | null; email?: string } | null
): Promise<string | null> {
    console.log('[SlugResolver] Resolving slug to modId:', { slug, hasAuth: !!auth, customerId: auth?.customerId });
    
    // CRITICAL: Slug index keys are: slug_{slug} -> modId
    // Check global slug index first (for public mods)
    const globalSlugKey = `slug_${slug}`;
    const globalModId = await env.MODS_KV.get(globalSlugKey, { type: 'text' });
    
    if (globalModId) {
        console.log('[SlugResolver] Found in global slug index:', { slug, modId: globalModId });
        return globalModId;
    }
    
    // Check customer scope slug index if authenticated
    if (auth?.customerId) {
        const customerSlugKey = getCustomerKey(auth.customerId, `slug_${slug}`);
        const customerModId = await env.MODS_KV.get(customerSlugKey, { type: 'text' });
        
        if (customerModId) {
            console.log('[SlugResolver] Found in customer slug index:', { slug, modId: customerModId, customerId: auth.customerId });
            return customerModId;
        }
    }
    
    // Search all customer scopes for slug index (for cross-customer access)
    // CRITICAL: This must work for unauthenticated requests (badge/thumbnail images)
    console.log('[SlugResolver] Searching all customer slug indexes...');
    const customerSlugPrefix = 'customer_';
    let cursor: string | undefined;
    
    do {
        const listResult = await env.MODS_KV.list({ prefix: customerSlugPrefix, cursor });
        
        for (const key of listResult.keys) {
            // Look for slug index keys: customer_{id}_slug_{slug}
            if (key.name.includes(`_slug_${slug}`) || key.name.includes(`/slug_${slug}`)) {
                const customerModId = await env.MODS_KV.get(key.name, { type: 'text' });
                
                if (customerModId) {
                    // Extract customerId from key for logging
                    const match = key.name.match(/^customer_(.+?)[_/]slug_/);
                    const customerId = match ? match[1] : null;
                    console.log('[SlugResolver] Found in customer slug index:', { slug, modId: customerModId, customerId, key: key.name });
                    return customerModId;
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    console.log('[SlugResolver] Slug not found in any index:', { slug });
    return null;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}

