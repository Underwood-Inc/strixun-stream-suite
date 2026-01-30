/**
 * Slug resolver utility
 * Converts slugs to modIds for URL routing using slug index
 */

import { indexGetSingle } from '@strixun/kv-entities';

/**
 * Resolve slug to modId using slug index
 * Uses direct index lookup for O(1) performance
 */
export async function resolveSlugToModId(
    slug: string,
    env: Env,
    _auth: { customerId: string; jwtToken: string } | null
): Promise<string | null> {
    // Direct lookup from slug index
    const modId = await indexGetSingle(env.MODS_KV, 'mods', 'by-slug', slug);
    return modId;
}

interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}
