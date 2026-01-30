/**
 * KV Entities - Entity Operations
 * 
 * Simple CRUD operations for entities. No scope bullshit.
 * Each entity is stored exactly once at its canonical key.
 */

import type { KVNamespace, ServiceId } from './types.js';
import { entityKey } from './keys.js';

/**
 * Get an entity by service, type, and id
 * 
 * @example
 * const mod = await getEntity<ModMetadata>(kv, 'mods', 'mod', 'abc123');
 */
export async function getEntity<T>(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    id: string
): Promise<T | null> {
    const { key } = entityKey(service, entity, id);
    return await kv.get(key, { type: 'json' }) as T | null;
}

/**
 * Put an entity (create or update)
 * Automatically sets updatedAt timestamp
 * 
 * @example
 * await putEntity(kv, 'mods', 'mod', 'abc123', modData);
 */
export async function putEntity<T extends { updatedAt?: string }>(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    id: string,
    data: T,
    options?: { expiration?: number; expirationTtl?: number }
): Promise<void> {
    const { key } = entityKey(service, entity, id);
    
    // Auto-set updatedAt
    const entityData = {
        ...data,
        updatedAt: new Date().toISOString()
    };
    
    await kv.put(key, JSON.stringify(entityData), options);
}

/**
 * Delete an entity
 * 
 * @example
 * await deleteEntity(kv, 'mods', 'mod', 'abc123');
 */
export async function deleteEntity(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    id: string
): Promise<void> {
    const { key } = entityKey(service, entity, id);
    await kv.delete(key);
}

/**
 * Check if an entity exists
 * 
 * @example
 * const exists = await entityExists(kv, 'mods', 'mod', 'abc123');
 */
export async function entityExists(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    id: string
): Promise<boolean> {
    const result = await getEntity(kv, service, entity, id);
    return result !== null;
}

/**
 * Get multiple entities by ids (batch get)
 * Returns array with nulls for missing entities
 * 
 * @example
 * const mods = await getEntities<ModMetadata>(kv, 'mods', 'mod', ['id1', 'id2', 'id3']);
 */
export async function getEntities<T>(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    ids: string[]
): Promise<(T | null)[]> {
    // KV doesn't have native batch get, so we parallelize
    return await Promise.all(
        ids.map(id => getEntity<T>(kv, service, entity, id))
    );
}

/**
 * Get multiple entities, filtering out nulls
 * 
 * @example
 * const mods = await getExistingEntities<ModMetadata>(kv, 'mods', 'mod', ['id1', 'id2', 'id3']);
 */
export async function getExistingEntities<T>(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    ids: string[]
): Promise<T[]> {
    const results = await getEntities<T>(kv, service, entity, ids);
    return results.filter((r): r is T => r !== null);
}

/**
 * Put multiple entities (batch put)
 * 
 * @example
 * await putEntities(kv, 'mods', 'mod', [
 *   { id: 'id1', data: mod1 },
 *   { id: 'id2', data: mod2 }
 * ]);
 */
export async function putEntities<T extends { updatedAt?: string }>(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    items: Array<{ id: string; data: T }>
): Promise<void> {
    await Promise.all(
        items.map(({ id, data }) => putEntity(kv, service, entity, id, data))
    );
}

/**
 * Delete multiple entities (batch delete)
 * 
 * @example
 * await deleteEntities(kv, 'mods', 'mod', ['id1', 'id2', 'id3']);
 */
export async function deleteEntities(
    kv: KVNamespace,
    service: ServiceId,
    entity: string,
    ids: string[]
): Promise<void> {
    await Promise.all(
        ids.map(id => deleteEntity(kv, service, entity, id))
    );
}
