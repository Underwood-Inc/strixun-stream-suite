/**
 * Migration: Unified Key Structure
 * 
 * Migrates from old scattered key patterns to unified entity/index pattern.
 * 
 * OLD PATTERN:
 *   customer_{customerId}_mod_{modId}   ← Customer scope
 *   mod_{modId}                          ← Global scope (duplicate!)
 *   customer_{customerId}_version_{versionId}
 *   version_{versionId}
 *   slug_{slug}
 *   customer_{customerId}_mods_list
 *   mods_list_public
 *   customer_{customerId}_mod_{modId}_versions
 * 
 * NEW PATTERN:
 *   mods:mod:{modId}                     ← Single source of truth
 *   mods:version:{versionId}
 *   mods:variant:{variantId}
 *   idx:mods:by-customer:{customerId}    ← Array of modIds
 *   idx:mods:by-visibility:public        ← Array of modIds
 *   idx:mods:versions-for:{modId}        ← Array of versionIds
 *   idx:mods:by-slug:{slug}              ← Single modId
 */

import type { Migration } from '../../shared/migration-runner.js';
import type { ModMetadata, ModVersion, ModVariant } from '../types/mod.js';

interface MigrationStats {
    mods: { processed: number; errors: number };
    versions: { processed: number; errors: number };
    variants: { processed: number; errors: number };
    indexes: { processed: number; errors: number };
    slugs: { processed: number; errors: number };
}

/**
 * Run the migration
 * 
 * @param env - Worker environment
 * @param options - Migration options
 */
export async function runMigration(
    env: Env,
    options: {
        dryRun?: boolean;
        deleteOld?: boolean;
        verbose?: boolean;
    } = {}
): Promise<{ success: boolean; stats: MigrationStats; errors: string[] }> {
    const { dryRun = true, deleteOld = false, verbose = false } = options;
    const kv = env.MODS_KV;
    const errors: string[] = [];
    
    const stats: MigrationStats = {
        mods: { processed: 0, errors: 0 },
        versions: { processed: 0, errors: 0 },
        variants: { processed: 0, errors: 0 },
        indexes: { processed: 0, errors: 0 },
        slugs: { processed: 0, errors: 0 },
    };
    
    const log = (msg: string) => {
        if (verbose) console.log(`[Migration] ${msg}`);
    };
    
    log(`Starting migration (dryRun=${dryRun}, deleteOld=${deleteOld})`);
    
    // Track what we've already migrated to avoid duplicates
    const migratedMods = new Set<string>();
    const migratedVersions = new Set<string>();
    const customerModIndex = new Map<string, string[]>();
    const modVersionIndex = new Map<string, string[]>();
    const variantVersionIndex = new Map<string, string[]>();
    const publicMods: string[] = [];
    
    try {
        // ===== PHASE 1: Migrate Mods =====
        log('Phase 1: Migrating mods...');
        
        // Scan all keys that look like mods
        const allKeys = await scanAllKeys(kv);
        const modKeys = allKeys.filter(k => 
            k.match(/^(?:customer_[^_]+(?:_[^_]+)*_)?mod_[^_]/) && 
            !k.includes('_versions') && 
            !k.includes('_snapshots') &&
            !k.includes('_ratings') &&
            !k.includes('_slug')
        );
        
        for (const oldKey of modKeys) {
            try {
                const mod = await kv.get(oldKey, { type: 'json' }) as ModMetadata | null;
                if (!mod || !mod.modId) continue;
                
                // Skip if already migrated
                if (migratedMods.has(mod.modId)) continue;
                migratedMods.add(mod.modId);
                
                // New key
                const newKey = `mods:mod:${mod.modId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(mod));
                }
                
                // Track for indexes
                if (mod.customerId) {
                    const existing = customerModIndex.get(mod.customerId) || [];
                    existing.push(mod.modId);
                    customerModIndex.set(mod.customerId, existing);
                }
                
                if (mod.visibility === 'public') {
                    publicMods.push(mod.modId);
                }
                
                // Migrate slug index
                if (mod.slug) {
                    const slugKey = `idx:mods:by-slug:${mod.slug}`;
                    if (!dryRun) {
                        await kv.put(slugKey, mod.modId);
                    }
                    stats.slugs.processed++;
                }
                
                // Migrate variants (they're embedded in mod)
                if (mod.variants && mod.variants.length > 0) {
                    for (const variant of mod.variants) {
                        const variantKey = `mods:variant:${variant.variantId}`;
                        if (!dryRun) {
                            await kv.put(variantKey, JSON.stringify(variant));
                        }
                        stats.variants.processed++;
                    }
                }
                
                stats.mods.processed++;
                
                if (deleteOld && !dryRun && !oldKey.startsWith('mods:')) {
                    await kv.delete(oldKey);
                }
                
            } catch (error) {
                stats.mods.errors++;
                errors.push(`Mod ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== PHASE 2: Migrate Versions =====
        log('Phase 2: Migrating versions...');
        
        const versionKeys = allKeys.filter(k => 
            k.match(/^(?:customer_[^_]+(?:_[^_]+)*_)?version_/) &&
            !k.includes('_versions')
        );
        
        for (const oldKey of versionKeys) {
            try {
                const version = await kv.get(oldKey, { type: 'json' }) as ModVersion | null;
                if (!version || !version.versionId) continue;
                
                // Skip if already migrated
                if (migratedVersions.has(version.versionId)) continue;
                migratedVersions.add(version.versionId);
                
                // New key
                const newKey = `mods:version:${version.versionId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(version));
                }
                
                // Track for mod->versions index
                if (version.modId) {
                    const modId = normalizeModId(version.modId);
                    
                    // Check if this is a variant version or main mod version
                    if ((version as any).variantId) {
                        const variantId = (version as any).variantId;
                        const existing = variantVersionIndex.get(variantId) || [];
                        existing.push(version.versionId);
                        variantVersionIndex.set(variantId, existing);
                    } else {
                        const existing = modVersionIndex.get(modId) || [];
                        existing.push(version.versionId);
                        modVersionIndex.set(modId, existing);
                    }
                }
                
                stats.versions.processed++;
                
                if (deleteOld && !dryRun && !oldKey.startsWith('mods:')) {
                    await kv.delete(oldKey);
                }
                
            } catch (error) {
                stats.versions.errors++;
                errors.push(`Version ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== PHASE 3: Write Indexes =====
        log('Phase 3: Writing indexes...');
        
        // Customer -> Mods index
        for (const [customerId, modIds] of customerModIndex) {
            const indexKey = `idx:mods:by-customer:${customerId}`;
            if (!dryRun) {
                await kv.put(indexKey, JSON.stringify(modIds));
            }
            stats.indexes.processed++;
        }
        
        // Public mods index
        if (publicMods.length > 0) {
            const indexKey = 'idx:mods:by-visibility:public';
            if (!dryRun) {
                await kv.put(indexKey, JSON.stringify(publicMods));
            }
            stats.indexes.processed++;
        }
        
        // Mod -> Versions indexes
        for (const [modId, versionIds] of modVersionIndex) {
            const indexKey = `idx:mods:versions-for:${modId}`;
            if (!dryRun) {
                await kv.put(indexKey, JSON.stringify(versionIds));
            }
            stats.indexes.processed++;
        }
        
        // Variant -> Versions indexes
        for (const [variantId, versionIds] of variantVersionIndex) {
            const indexKey = `idx:mods:versions-for-variant:${variantId}`;
            if (!dryRun) {
                await kv.put(indexKey, JSON.stringify(versionIds));
            }
            stats.indexes.processed++;
        }
        
        // ===== PHASE 4: Clean up old list keys =====
        if (deleteOld && !dryRun) {
            log('Phase 4: Cleaning up old list keys...');
            
            const listKeys = allKeys.filter(k => 
                k.includes('_mods_list') || 
                k.includes('_versions') ||
                k.startsWith('slug_')
            );
            
            for (const oldKey of listKeys) {
                try {
                    await kv.delete(oldKey);
                } catch (error) {
                    errors.push(`Cleanup ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        
        log('Migration complete!');
        log(`Mods: ${stats.mods.processed} processed, ${stats.mods.errors} errors`);
        log(`Versions: ${stats.versions.processed} processed, ${stats.versions.errors} errors`);
        log(`Variants: ${stats.variants.processed} processed, ${stats.variants.errors} errors`);
        log(`Indexes: ${stats.indexes.processed} created`);
        log(`Slugs: ${stats.slugs.processed} migrated`);
        
        return {
            success: errors.length === 0,
            stats,
            errors
        };
        
    } catch (error) {
        errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, stats, errors };
    }
}

/**
 * Scan all keys in KV namespace
 */
async function scanAllKeys(kv: KVNamespace): Promise<string[]> {
    const allKeys: string[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await kv.list({ limit: 1000, cursor });
        allKeys.push(...result.keys.map(k => k.name));
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    return allKeys;
}

/**
 * Normalize modId by stripping 'mod_' prefix if present
 */
function normalizeModId(modId: string): string {
    if (!modId) return modId;
    return modId.startsWith('mod_') ? modId.substring(4) : modId;
}

/**
 * Verify migration by checking key counts
 */
export async function verifyMigration(env: Env): Promise<{
    oldKeyCount: number;
    newKeyCount: number;
    indexCount: number;
}> {
    const kv = env.MODS_KV;
    const allKeys = await scanAllKeys(kv);
    
    const oldKeyCount = allKeys.filter(k => 
        k.startsWith('customer_') || 
        k.startsWith('mod_') || 
        k.startsWith('version_') ||
        k.startsWith('slug_') ||
        k.includes('_mods_list')
    ).length;
    
    const newKeyCount = allKeys.filter(k => 
        k.startsWith('mods:')
    ).length;
    
    const indexCount = allKeys.filter(k => 
        k.startsWith('idx:')
    ).length;
    
    return { oldKeyCount, newKeyCount, indexCount };
}

/**
 * Migration export for the migration runner
 */
export const migration: Migration = {
    id: '003_migrate_to_unified_keys',
    description: 'Migrate from scattered key patterns to unified entity/index pattern',
    
    async up(kv): Promise<void> {
        console.log('[Migration 003] Starting unified key migration...');
        
        // Create a minimal env wrapper for the existing function
        const env = { MODS_KV: kv };
        
        const result = await runMigration(env, {
            dryRun: false,
            deleteOld: false, // Keep old keys for safety - can clean up later
            verbose: true,
        });
        
        if (!result.success) {
            console.error('[Migration 003] Migration completed with errors:', result.errors);
        }
        
        console.log('[Migration 003] Complete. Stats:', result.stats);
    },
    
    async down(kv): Promise<void> {
        console.log('[Migration 003] Down migration not implemented - manual rollback required');
        // Down migration would require reversing all the changes
        // This is complex and error-prone, so we don't automate it
    }
};
