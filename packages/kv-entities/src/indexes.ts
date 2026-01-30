/**
 * KV Entities - Index Operations
 * 
 * Indexes are arrays of IDs stored at a key.
 * Used for queries like "all mods by customer" or "all versions for mod".
 */

import type { KVNamespace, ServiceId } from './types.js';
import { indexKey } from './keys.js';

/**
 * Get all IDs from an index
 * 
 * @example
 * const modIds = await indexGet(kv, 'mods', 'by-customer', 'cust_123');
 */
export async function indexGet(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string
): Promise<string[]> {
    const { key } = indexKey(service, relationship, parentId);
    const data = await kv.get(key, { type: 'json' }) as string[] | null;
    return data ?? [];
}

/**
 * Add an ID to an index (deduplicated)
 * 
 * @example
 * await indexAdd(kv, 'mods', 'by-customer', 'cust_123', 'mod_abc');
 */
export async function indexAdd(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string,
    id: string
): Promise<void> {
    const { key } = indexKey(service, relationship, parentId);
    const existing = await kv.get(key, { type: 'json' }) as string[] | null;
    const ids = existing ?? [];
    
    // Don't add duplicates
    if (!ids.includes(id)) {
        ids.push(id);
        await kv.put(key, JSON.stringify(ids));
    }
}

/**
 * Remove an ID from an index
 * 
 * @example
 * await indexRemove(kv, 'mods', 'by-customer', 'cust_123', 'mod_abc');
 */
export async function indexRemove(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string,
    id: string
): Promise<void> {
    const { key } = indexKey(service, relationship, parentId);
    const existing = await kv.get(key, { type: 'json' }) as string[] | null;
    
    if (existing) {
        const filtered = existing.filter(i => i !== id);
        if (filtered.length > 0) {
            await kv.put(key, JSON.stringify(filtered));
        } else {
            // Clean up empty indexes
            await kv.delete(key);
        }
    }
}

/**
 * Set an index to a specific set of IDs (replace all)
 * 
 * @example
 * await indexSet(kv, 'mods', 'by-customer', 'cust_123', ['mod_a', 'mod_b']);
 */
export async function indexSet(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string,
    ids: string[]
): Promise<void> {
    const { key } = indexKey(service, relationship, parentId);
    
    if (ids.length > 0) {
        await kv.put(key, JSON.stringify(ids));
    } else {
        await kv.delete(key);
    }
}

/**
 * Clear an index (delete it)
 * 
 * @example
 * await indexClear(kv, 'mods', 'by-customer', 'cust_123');
 */
export async function indexClear(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string
): Promise<void> {
    const { key } = indexKey(service, relationship, parentId);
    await kv.delete(key);
}

/**
 * Check if an ID exists in an index
 * 
 * @example
 * const isMember = await indexHas(kv, 'mods', 'by-customer', 'cust_123', 'mod_abc');
 */
export async function indexHas(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string,
    id: string
): Promise<boolean> {
    const ids = await indexGet(kv, service, relationship, parentId);
    return ids.includes(id);
}

/**
 * Get count of items in an index
 * 
 * @example
 * const count = await indexCount(kv, 'mods', 'by-customer', 'cust_123');
 */
export async function indexCount(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    parentId: string
): Promise<number> {
    const ids = await indexGet(kv, service, relationship, parentId);
    return ids.length;
}

/**
 * Store a single value in an index (for 1:1 mappings like slug -> modId)
 * 
 * @example
 * await indexSetSingle(kv, 'mods', 'by-slug', 'my-cool-mod', 'mod_abc123');
 */
export async function indexSetSingle(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    lookupKey: string,
    value: string
): Promise<void> {
    const { key } = indexKey(service, relationship, lookupKey);
    await kv.put(key, value);
}

/**
 * Get a single value from an index (for 1:1 mappings)
 * 
 * @example
 * const modId = await indexGetSingle(kv, 'mods', 'by-slug', 'my-cool-mod');
 */
export async function indexGetSingle(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    lookupKey: string
): Promise<string | null> {
    const { key } = indexKey(service, relationship, lookupKey);
    return await kv.get(key, { type: 'text' });
}

/**
 * Delete a single value index
 * 
 * @example
 * await indexDeleteSingle(kv, 'mods', 'by-slug', 'my-cool-mod');
 */
export async function indexDeleteSingle(
    kv: KVNamespace,
    service: ServiceId,
    relationship: string,
    lookupKey: string
): Promise<void> {
    const { key } = indexKey(service, relationship, lookupKey);
    await kv.delete(key);
}
