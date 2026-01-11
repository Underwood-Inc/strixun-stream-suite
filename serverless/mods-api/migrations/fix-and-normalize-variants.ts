/**
 * Migration: Fix and Normalize Variants
 * 
 * This migration does two things:
 * 1. Fixes existing variants that have null currentVersionId
 * 2. Creates separate variant_{variantId} KV keys for new architecture
 * 
 * Safe to run multiple times (idempotent)
 */

import type { Migration } from '../../shared/migration-runner.js';
import type { KVNamespace, KVNamespaceListResult } from '@cloudflare/workers-types';
import { getCustomerKey } from '../utils/customer.js';
import { getVariantVersionListKey, getVariantVersionKey } from '../utils/variant-versions.js';
import type { ModMetadata } from '../types/mod.js';
import type { ModVariant, VersionedResource } from '../../shared/types/variant.js';

export const migration: Migration = {
    id: '001_fix_and_normalize_variants',
    description: 'Fix null currentVersionId and create separate variant KV keys',
    
    async up(kv): Promise<void> {
        console.log('[Migration 001] Starting fix-and-normalize-variants...');
        
        let totalModsScanned = 0;
        let totalVariantsScanned = 0;
        let variantsFixed = 0;
        let variantsNormalized = 0;

        // Scan all mod keys
        let cursor: string | undefined = undefined;
        let listComplete = false;

        while (!listComplete) {
            const listResult: KVNamespaceListResult<unknown, string> = await kv.list({ prefix: 'mod_', cursor, limit: 100 });
            listComplete = listResult.list_complete;
            cursor = 'cursor' in listResult ? listResult.cursor : undefined;

            for (const key of listResult.keys) {
                totalModsScanned++;
                const mod = await kv.get(key.name, { type: 'json' }) as ModMetadata | null;

                if (!mod || !mod.variants || mod.variants.length === 0) {
                    continue;
                }

                let modUpdated = false;

                for (const variant of mod.variants) {
                    totalVariantsScanned++;

                    try {
                        // Ensure mod has customerId
                        if (!mod.customerId) {
                            console.warn(`[Migration 001] Mod ${mod.modId} has no customerId, skipping variant ${variant.variantId}`);
                            continue;
                        }

                        // STEP 1: Fix currentVersionId if null
                        if (variant.currentVersionId === null || variant.currentVersionId === undefined) {
                            const fixed = await fixVariantCurrentVersion(variant, mod.customerId, kv);
                            if (fixed) {
                                variantsFixed++;
                                modUpdated = true;
                            }
                        }

                        // STEP 2: Create separate variant_{variantId} key for new architecture
                        const normalized = await normalizeVariant(variant, mod, kv);
                        if (normalized) {
                            variantsNormalized++;
                        }
                    } catch (error: any) {
                        console.error(`[Migration 001] Error processing variant ${variant.variantId}:`, error);
                    }
                }

                // Save updated mod if any variants were fixed
                if (modUpdated) {
                    await kv.put(key.name, JSON.stringify(mod));
                    
                    // Also update global if public
                    if (mod.visibility === 'public') {
                        await kv.put(`mod_${mod.modId}`, JSON.stringify(mod));
                    }
                }
            }
        }

        console.log('[Migration 001] ✓ Complete:', {
            totalModsScanned,
            totalVariantsScanned,
            variantsFixed,
            variantsNormalized
        });
    },
};

/**
 * Fix a variant's currentVersionId if it's null
 * Returns true if fixed, false if already valid or no versions
 */
async function fixVariantCurrentVersion(
    variant: ModVariant,
    customerId: string,
    kv: KVNamespace
): Promise<boolean> {
    // Get version list for this variant
    const variantVersionsListKey = getVariantVersionListKey(customerId, variant.variantId);
    const versionIds = await kv.get(variantVersionsListKey, { type: 'json' }) as string[] | null;

    if (!versionIds || versionIds.length === 0) {
        return false;
    }

    // Fetch all versions to find the latest one
    const versions: VersionedResource[] = [];
    for (const versionId of versionIds) {
        const versionKey = getVariantVersionKey(customerId, versionId);
        const version = await kv.get(versionKey, { type: 'json' }) as VersionedResource | null;
        if (version) {
            versions.push(version);
        }
    }

    if (versions.length === 0) {
        return false;
    }

    // Sort versions by createdAt to find the latest
    versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestVersion = versions[0];

    // Update variant's currentVersionId
    variant.currentVersionId = latestVersion.versionId;
    variant.updatedAt = new Date().toISOString();

    console.log(`[Migration 001] Fixed variant ${variant.variantId}: currentVersionId = ${latestVersion.versionId}`);
    return true;
}

/**
 * Create separate variant_{variantId} KV key for new architecture
 * Returns true if created, false if already exists
 */
async function normalizeVariant(
    variant: ModVariant,
    mod: ModMetadata,
    kv: KVNamespace
): Promise<boolean> {
    if (!mod.customerId) {
        return false;
    }
    
    const variantKey = getCustomerKey(mod.customerId, `variant_${variant.variantId}`);
    
    // Check if variant key already exists
    const existing = await kv.get(variantKey);
    if (existing) {
        return false;
    }

    // Create separate variant key
    await kv.put(variantKey, JSON.stringify(variant));

    // Also create in global scope if mod is public
    if (mod.visibility === 'public') {
        await kv.put(`variant_${variant.variantId}`, JSON.stringify(variant));
    }

    // Create mod's variant list if it doesn't exist
    const variantListKey = getCustomerKey(mod.customerId, `mod_${mod.modId}_variants`);
    const variantList = await kv.get(variantListKey, { type: 'json' }) as string[] | null;
    
    if (!variantList) {
        // Create new list with all variants from mod
        const allVariantIds = mod.variants?.map(v => v.variantId) || [];
        await kv.put(variantListKey, JSON.stringify(allVariantIds));
    } else if (!variantList.includes(variant.variantId)) {
        // Add to existing list
        variantList.push(variant.variantId);
        await kv.put(variantListKey, JSON.stringify(variantList));
    }

    console.log(`[Migration 001] Normalized variant ${variant.variantId}: Created separate KV key`);
    return true;
}
