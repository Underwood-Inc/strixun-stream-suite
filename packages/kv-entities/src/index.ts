/**
 * @strixun/kv-entities
 * 
 * Unified KV entity storage pattern for all Cloudflare Workers services.
 * 
 * Key Pattern:
 *   Entity: {service}:{entity}:{id}
 *   Index:  idx:{service}:{relationship}:{parentId}
 * 
 * @example
 * import { getEntity, putEntity, indexAdd, Keys, Indexes } from '@strixun/kv-entities';
 * 
 * // Get a mod
 * const mod = await getEntity<ModMetadata>(kv, 'mods', 'mod', modId);
 * 
 * // Or use convenience keys
 * const mod = await kv.get(Keys.mod(modId).key, { type: 'json' });
 * 
 * // Add to index
 * await indexAdd(kv, 'mods', 'by-customer', customerId, modId);
 * 
 * // Check access
 * if (!canAccessVisible(mod, { customerId, isAdmin })) {
 *   return new Response('Forbidden', { status: 403 });
 * }
 */

// Types
export type {
    KVNamespace,
    ServiceId,
    BaseEntity,
    OwnedEntity,
    VisibleEntity,
    EntityKey,
    IndexKey,
    AccessContext,
    MigrationRecord,
} from './types.js';

// Key builders
export {
    entityKey,
    indexKey,
    parseEntityKey,
    parseIndexKey,
    Keys,
    Indexes,
} from './keys.js';

// Entity operations
export {
    getEntity,
    putEntity,
    deleteEntity,
    entityExists,
    getEntities,
    getExistingEntities,
    putEntities,
    deleteEntities,
} from './entities.js';

// Index operations
export {
    indexGet,
    indexAdd,
    indexRemove,
    indexSet,
    indexClear,
    indexHas,
    indexCount,
    indexSetSingle,
    indexGetSingle,
    indexDeleteSingle,
} from './indexes.js';

// Access control
export {
    canAccessOwned,
    canAccessVisible,
    canModify,
    canDelete,
    filterAccessible,
    filterAccessibleOwned,
    assertAccess,
} from './access.js';

// Migration utilities
export {
    OldKeyPatterns,
    transformKey,
    scanOldKeys,
    createMigrationRecord,
    saveMigrationRecord,
    completeMigration,
    migrateService,
} from './migration.js';
