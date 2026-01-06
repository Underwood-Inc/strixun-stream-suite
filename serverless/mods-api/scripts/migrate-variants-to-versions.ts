/**
 * Migration Script: Convert Existing Variants to Version Control System
 * ARCHITECTURAL IMPROVEMENT: Migrate old variant structure to new VariantVersion system
 * 
 * This script:
 * 1. Finds all mods with variants
 * 2. Creates VariantVersion records from existing variant data
 * 3. Updates variant structure (removes file fields, adds version tracking)
 * 4. Migrates R2 files to new path structure
 * 5. Maintains backward compatibility during transition
 * 
 * Run with: wrangler dev --local --persist --test-scheduled
 */

import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../utils/customer.js';
import {
    generateVariantVersionId,
    saveVariantVersion,
    addVariantVersionToList,
    getVariantVersionR2Key,
    saveVariant
} from '../utils/variant-versions.js';
import type { ModMetadata, ModVariant, VariantVersion } from '../types/mod.js';
import type { Env } from '../types/global.js';

/**
 * Old variant structure (before migration)
 */
interface OldModVariant {
    variantId: string;
    name: string;
    description?: string;
    fileUrl?: string;
    r2Key?: string;
    fileName?: string;
    fileSize?: number;
    version?: string;
    changelog?: string;
    gameVersions?: string[];
    dependencies?: any[];
    createdAt?: string;
    updatedAt?: string;
    downloads?: number;
}

/**
 * Check if variant has already been migrated
 */
function isVariantMigrated(variant: any): boolean {
    // Migrated variants have these new fields
    return !!(
        variant.currentVersionId &&
        variant.versionCount !== undefined &&
        variant.totalDownloads !== undefined &&
        // And missing old fields
        !variant.fileUrl &&
        !variant.r2Key &&
        !variant.fileName
    );
}

/**
 * Migrate a single variant to version control
 */
async function migrateVariant(
    mod: ModMetadata,
    oldVariant: OldModVariant,
    env: Env
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[Migration] Migrating variant ${oldVariant.variantId} for mod ${mod.modId}`);
        
        // Check if already migrated
        if (isVariantMigrated(oldVariant)) {
            console.log(`[Migration] Variant ${oldVariant.variantId} already migrated, skipping`);
            return { success: true };
        }
        
        // Check if variant has a file (some variants might be metadata-only)
        if (!oldVariant.fileUrl && !oldVariant.r2Key && !oldVariant.fileName) {
            console.log(`[Migration] Variant ${oldVariant.variantId} has no file, skipping`);
            return { success: true };
        }
        
        // Generate variant version ID for the initial version
        const variantVersionId = generateVariantVersionId();
        const now = new Date().toISOString();
        
        // Extract file extension from fileName
        const fileName = oldVariant.fileName || 'variant.zip';
        const fileExtension = fileName.includes('.') 
            ? fileName.substring(fileName.lastIndexOf('.')).substring(1)
            : 'zip';
        
        // Generate new R2 key with hierarchical structure
        const normalizedModId = normalizeModId(mod.modId);
        const newR2Key = getVariantVersionR2Key(
            normalizedModId,
            oldVariant.variantId,
            variantVersionId,
            fileExtension,
            mod.customerId
        );
        
        // Copy file to new location if R2 key exists
        if (oldVariant.r2Key) {
            try {
                const oldFile = await env.MODS_R2.get(oldVariant.r2Key);
                
                if (oldFile) {
                    console.log(`[Migration] Copying file from ${oldVariant.r2Key} to ${newR2Key}`);
                    
                    await env.MODS_R2.put(newR2Key, oldFile.body, {
                        httpMetadata: oldFile.httpMetadata,
                        customMetadata: {
                            ...oldFile.customMetadata,
                            variantVersionId,
                            migratedFrom: oldVariant.r2Key,
                            migratedAt: now
                        }
                    });
                    
                    console.log(`[Migration] File copied successfully`);
                } else {
                    console.warn(`[Migration] Old file not found at ${oldVariant.r2Key}, skipping file copy`);
                }
            } catch (error) {
                console.error(`[Migration] Error copying file:`, error);
                // Continue migration even if file copy fails
            }
        }
        
        // Generate download URL
        const downloadUrl = env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${newR2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${newR2Key}`;
        
        // Create VariantVersion from old variant data
        const variantVersion: VariantVersion = {
            variantVersionId,
            variantId: oldVariant.variantId,
            modId: mod.modId,
            version: oldVariant.version || '1.0.0', // Default to 1.0.0 if not specified
            changelog: oldVariant.changelog || 'Initial version (migrated from old variant system)',
            fileSize: oldVariant.fileSize || 0,
            fileName: fileName,
            r2Key: newR2Key,
            downloadUrl,
            sha256: '', // Will be populated during file re-hash if needed
            createdAt: oldVariant.createdAt || now,
            downloads: oldVariant.downloads || 0,
            gameVersions: oldVariant.gameVersions || [],
            dependencies: oldVariant.dependencies || [],
        };
        
        // Save variant version
        await saveVariantVersion(variantVersion, mod.customerId, env);
        console.log(`[Migration] Created VariantVersion ${variantVersionId}`);
        
        // Add to variant's version list
        await addVariantVersionToList(oldVariant.variantId, variantVersionId, mod.customerId, env);
        console.log(`[Migration] Added version to variant's version list`);
        
        // Update variant to new structure
        const newVariant: ModVariant = {
            variantId: oldVariant.variantId,
            modId: mod.modId,
            name: oldVariant.name,
            description: oldVariant.description,
            createdAt: oldVariant.createdAt || now,
            updatedAt: now,
            currentVersionId: variantVersionId,
            versionCount: 1,
            totalDownloads: oldVariant.downloads || 0,
        };
        
        // Save updated variant
        await saveVariant(newVariant, mod.customerId, env);
        console.log(`[Migration] Updated variant ${oldVariant.variantId} to new structure`);
        
        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Migration] Error migrating variant ${oldVariant.variantId}:`, error);
        return { success: false, error: errorMsg };
    }
}

/**
 * Find all mods and migrate their variants
 */
export async function migrateAllVariantsToVersions(env: Env): Promise<{
    totalMods: number;
    modsWithVariants: number;
    variantsMigrated: number;
    variantsSkipped: number;
    errors: Array<{ modId: string; variantId: string; error: string }>;
}> {
    console.log('[Migration] Starting variant migration to version control system');
    
    const stats = {
        totalMods: 0,
        modsWithVariants: 0,
        variantsMigrated: 0,
        variantsSkipped: 0,
        errors: [] as Array<{ modId: string; variantId: string; error: string }>
    };
    
    // Scan all KV keys to find mods
    let cursor: string | undefined;
    const processedMods = new Set<string>();
    
    do {
        const listResult = await env.MODS_KV.list({ cursor });
        
        for (const key of listResult.keys) {
            // Find mod keys (both customer-scoped and global)
            if (key.name.startsWith('customer_') && key.name.includes('_mod_')) {
                // Customer-scoped mod
                const modKey = key.name;
                
                try {
                    const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
                    
                    if (!mod || !mod.modId) {
                        continue;
                    }
                    
                    // Skip if already processed
                    if (processedMods.has(mod.modId)) {
                        continue;
                    }
                    
                    processedMods.add(mod.modId);
                    stats.totalMods++;
                    
                    // Check if mod has variants
                    if (!mod.variants || mod.variants.length === 0) {
                        continue;
                    }
                    
                    stats.modsWithVariants++;
                    console.log(`[Migration] Found mod with variants: ${mod.modId} (${mod.variants.length} variants)`);
                    
                    // Migrate each variant
                    for (const variant of mod.variants) {
                        const result = await migrateVariant(mod, variant as OldModVariant, env);
                        
                        if (result.success) {
                            stats.variantsMigrated++;
                        } else if (result.error) {
                            stats.errors.push({
                                modId: mod.modId,
                                variantId: variant.variantId,
                                error: result.error
                            });
                        } else {
                            stats.variantsSkipped++;
                        }
                    }
                    
                    // Update mod's variant list in KV
                    await env.MODS_KV.put(modKey, JSON.stringify(mod));
                    
                } catch (error) {
                    console.error(`[Migration] Error processing mod ${key.name}:`, error);
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    console.log('[Migration] Variant migration complete');
    console.log('[Migration] Stats:', stats);
    
    return stats;
}

/**
 * Dry run - test migration without making changes
 */
export async function dryRunVariantMigration(env: Env): Promise<{
    modsToMigrate: number;
    variantsToMigrate: number;
    variantsAlreadyMigrated: number;
}> {
    console.log('[Migration] Starting DRY RUN - no changes will be made');
    
    const stats = {
        modsToMigrate: 0,
        variantsToMigrate: 0,
        variantsAlreadyMigrated: 0
    };
    
    let cursor: string | undefined;
    const processedMods = new Set<string>();
    
    do {
        const listResult = await env.MODS_KV.list({ cursor });
        
        for (const key of listResult.keys) {
            if (key.name.startsWith('customer_') && key.name.includes('_mod_')) {
                try {
                    const mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                    
                    if (!mod || !mod.modId || processedMods.has(mod.modId)) {
                        continue;
                    }
                    
                    processedMods.add(mod.modId);
                    
                    if (!mod.variants || mod.variants.length === 0) {
                        continue;
                    }
                    
                    stats.modsToMigrate++;
                    
                    for (const variant of mod.variants) {
                        if (isVariantMigrated(variant)) {
                            stats.variantsAlreadyMigrated++;
                        } else {
                            stats.variantsToMigrate++;
                            console.log(`[DRY RUN] Would migrate: ${mod.modId} / ${variant.variantId} / ${variant.name}`);
                        }
                    }
                } catch (error) {
                    console.error(`[DRY RUN] Error reading mod ${key.name}:`, error);
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    console.log('[DRY RUN] Complete');
    console.log('[DRY RUN] Stats:', stats);
    
    return stats;
}

