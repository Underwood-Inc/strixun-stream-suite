/**
 * Lazy Variant Migration Utilities
 * ARCHITECTURAL IMPROVEMENT: Migrate variants on-the-fly during user interactions
 * 
 * This approach:
 * - No maintenance window needed
 * - No bulk migration script
 * - Migrates only when users access/update mods
 * - Fully backward compatible
 */

import {
    generateVariantVersionId,
    saveVariantVersion,
    addVariantVersionToList,
    getVariantVersionR2Key,
    saveVariant
} from './variant-versions.js';
import type { ModMetadata, ModVariant, VariantVersion } from '../types/mod.js';
import type { Env } from '../types/global.js';

/**
 * Old variant structure (before migration)
 */
interface OldVariant {
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
    // Missing new fields:
    currentVersionId?: never;
    versionCount?: never;
    totalDownloads?: never;
}

/**
 * Check if a variant needs migration
 */
export function needsVariantMigration(variant: any): variant is OldVariant {
    // Old variants have file fields and are missing new tracking fields
    return !!(
        (variant.fileUrl || variant.r2Key || variant.fileName) &&
        !variant.currentVersionId &&
        variant.versionCount === undefined &&
        variant.totalDownloads === undefined
    );
}

/**
 * Migrate a single variant on-the-fly
 * Called whenever we load a mod with old-style variants
 */
export async function migrateVariantOnTheFly(
    mod: ModMetadata,
    oldVariant: OldVariant,
    env: Env
): Promise<ModVariant> {
    console.log(`[LazyMigration] Migrating variant ${oldVariant.variantId} for mod ${mod.modId}`);
    
    const now = new Date().toISOString();
    
    // If variant has no file, just convert to new structure without creating a version
    if (!oldVariant.fileUrl && !oldVariant.r2Key && !oldVariant.fileName) {
        console.log(`[LazyMigration] Variant ${oldVariant.variantId} has no file, creating empty structure`);
        const newVariant: ModVariant = {
            variantId: oldVariant.variantId,
            modId: mod.modId,
            name: oldVariant.name,
            description: oldVariant.description,
            createdAt: oldVariant.createdAt || now,
            updatedAt: now,
            currentVersionId: '', // No version yet
            versionCount: 0,
            totalDownloads: 0,
        };
        
        await saveVariant(newVariant, mod.customerId, env);
        return newVariant;
    }
    
    // Create VariantVersion from old variant data
    const variantVersionId = generateVariantVersionId();
    
    // Determine file extension
    const fileName = oldVariant.fileName || 'variant.zip';
    const fileExtension = fileName.includes('.') 
        ? fileName.substring(fileName.lastIndexOf('.')).substring(1)
        : 'zip';
    
    // Generate new R2 key with hierarchical structure
    const normalizedModId = mod.modId.startsWith('mod_') ? mod.modId.substring(4) : mod.modId;
    const newR2Key = getVariantVersionR2Key(
        normalizedModId,
        oldVariant.variantId,
        variantVersionId,
        fileExtension,
        mod.customerId
    );
    
    // Copy file to new location if old R2 key exists
    if (oldVariant.r2Key) {
        try {
            const oldFile = await env.MODS_R2.get(oldVariant.r2Key);
            
            if (oldFile) {
                console.log(`[LazyMigration] Copying file from ${oldVariant.r2Key} to ${newR2Key}`);
                
                await env.MODS_R2.put(newR2Key, oldFile.body, {
                    httpMetadata: oldFile.httpMetadata,
                    customMetadata: {
                        ...oldFile.customMetadata,
                        variantVersionId,
                        migratedFrom: oldVariant.r2Key,
                        migratedAt: now,
                        migrationType: 'lazy'
                    }
                });
                
                console.log(`[LazyMigration] File copied successfully`);
            } else {
                console.warn(`[LazyMigration] Old file not found at ${oldVariant.r2Key}`);
            }
        } catch (error) {
            console.error(`[LazyMigration] Error copying file:`, error);
            // Continue migration even if file copy fails
        }
    }
    
    // Generate download URL
    const downloadUrl = env.MODS_PUBLIC_URL 
        ? `${env.MODS_PUBLIC_URL}/${newR2Key}`
        : newR2Key;
    
    // Create VariantVersion
    const variantVersion: VariantVersion = {
        variantVersionId,
        variantId: oldVariant.variantId,
        modId: mod.modId,
        version: oldVariant.version || '1.0.0',
        changelog: oldVariant.changelog || 'Initial version (auto-migrated)',
        fileSize: oldVariant.fileSize || 0,
        fileName: fileName,
        r2Key: newR2Key,
        downloadUrl,
        sha256: '', // Will be populated during re-hash if needed
        createdAt: oldVariant.createdAt || now,
        downloads: oldVariant.downloads || 0,
        gameVersions: oldVariant.gameVersions || [],
        dependencies: oldVariant.dependencies || [],
    };
    
    // Save variant version
    await saveVariantVersion(variantVersion, mod.customerId, env);
    
    // Add to variant's version list
    await addVariantVersionToList(oldVariant.variantId, variantVersionId, mod.customerId, env);
    
    // Create new variant structure
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
    
    console.log(`[LazyMigration] Successfully migrated variant ${oldVariant.variantId}`);
    
    return newVariant;
}

/**
 * Migrate all variants in a mod that need migration
 * Called whenever a mod is loaded
 */
export async function migrateModVariantsIfNeeded(
    mod: ModMetadata,
    env: Env
): Promise<ModMetadata> {
    if (!mod.variants || mod.variants.length === 0) {
        return mod;
    }
    
    let needsUpdate = false;
    const migratedVariants: ModVariant[] = [];
    
    for (const variant of mod.variants) {
        if (needsVariantMigration(variant)) {
            console.log(`[LazyMigration] Variant ${variant.variantId} needs migration`);
            const migratedVariant = await migrateVariantOnTheFly(mod, variant, env);
            migratedVariants.push(migratedVariant);
            needsUpdate = true;
        } else {
            // Already migrated, keep as-is
            migratedVariants.push(variant as ModVariant);
        }
    }
    
    // If any variants were migrated, update the mod
    if (needsUpdate) {
        mod.variants = migratedVariants;
        
        // Save updated mod metadata
        const { getCustomerKey } = await import('./customer.js');
        const modKey = getCustomerKey(mod.customerId, `mod_${mod.modId}`);
        await env.MODS_KV.put(modKey, JSON.stringify(mod));
        
        console.log(`[LazyMigration] Updated mod ${mod.modId} with migrated variants`);
    }
    
    return mod;
}

/**
 * Wrap mod retrieval with automatic migration
 * Use this in all handlers that load mods
 */
export async function getModWithMigration(
    modId: string,
    customerId: string | null,
    env: Env
): Promise<ModMetadata | null> {
    const { getCustomerKey } = await import('./customer.js');
    const modKey = getCustomerKey(customerId, `mod_${modId}`);
    const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
    
    if (!mod) {
        return null;
    }
    
    // Automatically migrate variants if needed
    return await migrateModVariantsIfNeeded(mod, env);
}
