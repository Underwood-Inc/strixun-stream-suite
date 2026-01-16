/**
 * Migration: Attach Variants to First Version
 * 
 * This migration attaches all existing variants to the first (oldest) version
 * of their parent mod by setting the parentVersionId field.
 * 
 * This is a safe, non-destructive migration that:
 * - Only sets parentVersionId if it's currently missing/empty
 * - Attaches to the FIRST (oldest) version, allowing manual cleanup later
 * - Does NOT remove any variants - just links them to a version
 * 
 * Safe to run multiple times (idempotent)
 */

import type { Migration } from '../../shared/migration-runner.js';
import type { KVNamespaceListResult } from '@cloudflare/workers-types';
import type { ModMetadata, ModVersion, ModVariant } from '../types/mod.js';

export const migration: Migration = {
    id: '002_attach_variants_to_first_version',
    description: 'Attach existing variants to first mod version via parentVersionId',
    
    async up(kv): Promise<void> {
        console.log('[Migration 002] Starting attach-variants-to-first-version...');
        
        let totalModsScanned = 0;
        let modsWithVariants = 0;
        let variantsUpdated = 0;
        let variantsSkipped = 0;
        let modsWithNoVersions = 0;

        // Scan all mod keys
        let cursor: string | undefined = undefined;
        let listComplete = false;

        while (!listComplete) {
            const listResult: KVNamespaceListResult<unknown, string> = await kv.list({ prefix: 'mod_', cursor, limit: 100 });
            listComplete = listResult.list_complete;
            cursor = 'cursor' in listResult ? listResult.cursor : undefined;

            for (const key of listResult.keys) {
                // Skip version list keys, variant keys, etc.
                if (key.name.includes('_versions') || key.name.includes('_variants') || key.name.includes('variant_')) {
                    continue;
                }

                totalModsScanned++;
                const mod = await kv.get(key.name, { type: 'json' }) as ModMetadata | null;

                if (!mod || !mod.variants || mod.variants.length === 0) {
                    continue;
                }

                modsWithVariants++;
                let modUpdated = false;

                // Get the first (oldest) version for this mod
                const firstVersion = await getFirstVersion(mod, kv);
                
                if (!firstVersion) {
                    console.warn(`[Migration 002] Mod ${mod.modId} (${mod.slug}) has variants but no versions, skipping`);
                    modsWithNoVersions++;
                    continue;
                }

                console.log(`[Migration 002] Processing mod ${mod.slug} - attaching variants to first version ${firstVersion.version} (${firstVersion.versionId})`);

                for (const variant of mod.variants) {
                    // Only update if parentVersionId is missing or empty
                    if (!variant.parentVersionId || variant.parentVersionId === '') {
                        (variant as ModVariant).parentVersionId = firstVersion.versionId;
                        variantsUpdated++;
                        modUpdated = true;
                        console.log(`[Migration 002]   - Attached variant "${variant.name}" (${variant.variantId}) to version ${firstVersion.version}`);
                    } else {
                        variantsSkipped++;
                        console.log(`[Migration 002]   - Skipped variant "${variant.name}" (already has parentVersionId: ${variant.parentVersionId})`);
                    }
                }

                // Save updated mod if any variants were updated
                if (modUpdated) {
                    await kv.put(key.name, JSON.stringify(mod));
                    console.log(`[Migration 002] Saved mod ${mod.slug}`);
                    
                    // Also update the global scope key if it exists
                    if (mod.visibility === 'public') {
                        const globalKey = `mod_${mod.modId}`;
                        if (globalKey !== key.name) {
                            await kv.put(globalKey, JSON.stringify(mod));
                            console.log(`[Migration 002] Updated global key ${globalKey}`);
                        }
                    }
                }
            }
        }

        console.log('[Migration 002] Complete!');
        console.log(`[Migration 002] Summary:`);
        console.log(`  - Total mods scanned: ${totalModsScanned}`);
        console.log(`  - Mods with variants: ${modsWithVariants}`);
        console.log(`  - Mods with no versions: ${modsWithNoVersions}`);
        console.log(`  - Variants updated: ${variantsUpdated}`);
        console.log(`  - Variants skipped (already had parentVersionId): ${variantsSkipped}`);
    },

    async down(_kv): Promise<void> {
        // This migration is not reversible - we don't want to accidentally
        // remove parentVersionId values that may have been set correctly
        console.log('[Migration 002] Down migration not implemented - manual cleanup only');
        console.log('[Migration 002] To revert, manually set parentVersionId to empty string or null for affected variants');
    }
};

/**
 * Get the first (oldest) version for a mod
 * Sorted by createdAt ascending to find the oldest
 */
async function getFirstVersion(mod: ModMetadata, kv: KVNamespace): Promise<ModVersion | null> {
    // Try to get version list from customer-scoped key first
    let versionIds: string[] = [];
    
    if (mod.customerId) {
        const customerVersionListKey = `customer_${mod.customerId}_mod_${mod.modId}_versions`;
        const customerVersionList = await kv.get(customerVersionListKey, { type: 'json' }) as string[] | null;
        if (customerVersionList) {
            versionIds = customerVersionList;
        }
    }
    
    // Fallback to global key
    if (versionIds.length === 0) {
        const globalVersionListKey = `mod_${mod.modId}_versions`;
        const globalVersionList = await kv.get(globalVersionListKey, { type: 'json' }) as string[] | null;
        if (globalVersionList) {
            versionIds = globalVersionList;
        }
    }
    
    if (versionIds.length === 0) {
        return null;
    }
    
    // Fetch all versions to find the oldest
    const versions: ModVersion[] = [];
    
    for (const versionId of versionIds) {
        let version: ModVersion | null = null;
        
        // Try customer-scoped key first
        if (mod.customerId) {
            const customerVersionKey = `customer_${mod.customerId}_version_${versionId}`;
            version = await kv.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Fallback to global key
        if (!version) {
            const globalVersionKey = `version_${versionId}`;
            version = await kv.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        if (version) {
            versions.push(version);
        }
    }
    
    if (versions.length === 0) {
        return null;
    }
    
    // Sort by createdAt ascending (oldest first)
    versions.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime; // Ascending - oldest first
    });
    
    return versions[0];
}
