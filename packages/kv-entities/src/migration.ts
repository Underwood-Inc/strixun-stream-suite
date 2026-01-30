/**
 * KV Entities - Migration Utilities
 * 
 * Helpers for migrating from old key patterns to the new unified pattern.
 */

import type { KVNamespace, ServiceId, MigrationRecord } from './types.js';
import { entityKey, indexKey } from './keys.js';

/**
 * Old key patterns that need migration
 */
export const OldKeyPatterns = {
    // Mods service old patterns
    mods: {
        // Old: customer_{customerId}_mod_{modId} or mod_{modId}
        mod: /^(?:customer_([^_]+(?:_[^_]+)*)_)?mod_(.+)$/,
        // Old: customer_{customerId}_version_{versionId} or version_{versionId}
        version: /^(?:customer_([^_]+(?:_[^_]+)*)_)?version_(.+)$/,
        // Old: customer_{customerId}_variant_{variantId}_versions
        variantVersions: /^(?:customer_([^_]+(?:_[^_]+)*)_)?variant_(.+)_versions$/,
        // Old: slug_{slug}
        slug: /^slug_(.+)$/,
        // Old: customer_{customerId}_mods_list or mods_list_public
        modsList: /^(?:customer_([^_]+(?:_[^_]+)*)_)?mods_list(?:_public)?$/,
    },
    
    // Customer service old patterns
    customer: {
        // Old: customer_{customerId} or customer:{customerId}
        profile: /^customer[_:](.+)$/,
    },
    
    // Access service old patterns
    access: {
        // Old: access_{customerId}_permissions
        permissions: /^access_(.+)_permissions$/,
    },
};

/**
 * Transform an old key to new key format
 * Returns null if key doesn't match any known old pattern
 */
export function transformKey(
    oldKey: string,
    service: ServiceId
): { newKey: string; entityType: string; id: string; customerId?: string } | null {
    const patterns = OldKeyPatterns[service as keyof typeof OldKeyPatterns];
    if (!patterns) return null;
    
    for (const [entityType, pattern] of Object.entries(patterns)) {
        const match = oldKey.match(pattern);
        if (match) {
            // Extract ID and optional customerId from match groups
            const customerId = match[1] || undefined;
            const id = match[2] || match[1]; // Some patterns only have one group
            
            if (id) {
                const { key: newKey } = entityKey(service, entityType, id);
                return { newKey, entityType, id, customerId };
            }
        }
    }
    
    return null;
}

/**
 * Scan KV for keys matching old patterns
 */
export async function scanOldKeys(
    kv: KVNamespace,
    prefix: string,
    batchSize: number = 1000
): Promise<string[]> {
    const allKeys: string[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await kv.list({ prefix, limit: batchSize, cursor });
        allKeys.push(...result.keys.map(k => k.name));
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    return allKeys;
}

/**
 * Create a migration record
 */
export function createMigrationRecord(name: string): MigrationRecord {
    return {
        id: `migration_${Date.now()}`,
        name,
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'running',
        processedCount: 0,
        errorCount: 0,
        errors: [],
    };
}

/**
 * Save migration progress
 */
export async function saveMigrationRecord(
    kv: KVNamespace,
    record: MigrationRecord
): Promise<void> {
    await kv.put(`migration:${record.id}`, JSON.stringify(record));
}

/**
 * Complete a migration record
 */
export function completeMigration(record: MigrationRecord): MigrationRecord {
    return {
        ...record,
        completedAt: new Date().toISOString(),
        status: record.errorCount > 0 ? 'failed' : 'completed',
    };
}

/**
 * Generic migration function
 * 
 * @param kv - KV namespace
 * @param service - Service being migrated
 * @param transformer - Function to transform old data to new format
 * @param options - Migration options
 */
export async function migrateService<TOld, TNew>(
    kv: KVNamespace,
    service: ServiceId,
    prefixes: string[],
    transformer: (oldKey: string, oldData: TOld) => { 
        entityType: string;
        id: string;
        data: TNew;
        indexes?: Array<{ relationship: string; parentId: string; id: string }>;
    } | null,
    options: {
        dryRun?: boolean;
        onProgress?: (processed: number, total: number) => void;
        deleteOld?: boolean;
    } = {}
): Promise<MigrationRecord> {
    const { dryRun = true, onProgress, deleteOld = false } = options;
    const record = createMigrationRecord(`migrate-${service}`);
    
    try {
        // Collect all keys to migrate
        const allKeys: string[] = [];
        for (const prefix of prefixes) {
            const keys = await scanOldKeys(kv, prefix);
            allKeys.push(...keys);
        }
        
        const total = allKeys.length;
        console.log(`[Migration] Found ${total} keys to process for ${service}`);
        
        for (const oldKey of allKeys) {
            try {
                // Skip keys that are already in new format
                if (oldKey.startsWith(`${service}:`) || oldKey.startsWith('idx:')) {
                    continue;
                }
                
                // Get old data
                const oldData = await kv.get(oldKey, { type: 'json' }) as TOld;
                if (!oldData) continue;
                
                // Transform
                const result = transformer(oldKey, oldData);
                if (!result) continue;
                
                const { entityType, id, data, indexes } = result;
                const { key: newKey } = entityKey(service, entityType, id);
                
                if (!dryRun) {
                    // Write new entity
                    await kv.put(newKey, JSON.stringify(data));
                    
                    // Write indexes
                    if (indexes) {
                        for (const idx of indexes) {
                            const { key: idxKey } = indexKey(service, idx.relationship, idx.parentId);
                            const existing = await kv.get(idxKey, { type: 'json' }) as string[] | null;
                            const ids = existing ?? [];
                            if (!ids.includes(idx.id)) {
                                ids.push(idx.id);
                                await kv.put(idxKey, JSON.stringify(ids));
                            }
                        }
                    }
                    
                    // Optionally delete old key
                    if (deleteOld) {
                        await kv.delete(oldKey);
                    }
                }
                
                record.processedCount++;
                
                if (onProgress && record.processedCount % 100 === 0) {
                    onProgress(record.processedCount, total);
                }
                
            } catch (error) {
                record.errorCount++;
                record.errors.push(`${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        return completeMigration(record);
        
    } catch (error) {
        record.errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
        record.status = 'failed';
        return record;
    }
}
