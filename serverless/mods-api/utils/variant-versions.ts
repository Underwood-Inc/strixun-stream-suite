/**
 * Variant Version Utilities
 * ARCHITECTURAL IMPROVEMENT: Full version control for mod variants
 * Each variant can now have multiple versions with complete history
 */

import { getCustomerKey, getCustomerR2Key } from './customer.js';
import type { VariantVersion, ModVariant } from '../types/mod.js';

/**
 * Generate unique variant version ID
 */
export function generateVariantVersionId(): string {
    return `varver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get variant version metadata from KV
 */
export async function getVariantVersion(
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<VariantVersion | null> {
    const key = getCustomerKey(customerId, `variant_version_${variantVersionId}`);
    return await env.MODS_KV.get(key, { type: 'json' }) as VariantVersion | null;
}

/**
 * Save variant version metadata to KV
 */
export async function saveVariantVersion(
    variantVersion: VariantVersion,
    customerId: string | null,
    env: Env
): Promise<void> {
    const key = getCustomerKey(customerId, `variant_version_${variantVersion.variantVersionId}`);
    await env.MODS_KV.put(key, JSON.stringify(variantVersion));
}

/**
 * Get all version IDs for a variant
 */
export async function getVariantVersionIds(
    variantId: string,
    customerId: string | null,
    env: Env
): Promise<string[]> {
    const key = getCustomerKey(customerId, `variant_${variantId}_versions`);
    const versions = await env.MODS_KV.get(key, { type: 'json' }) as string[] | null;
    return versions || [];
}

/**
 * Add version ID to variant's version list
 */
export async function addVariantVersionToList(
    variantId: string,
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    const key = getCustomerKey(customerId, `variant_${variantId}_versions`);
    const versions = await getVariantVersionIds(variantId, customerId, env);
    
    // Only add if not already present
    if (!versions.includes(variantVersionId)) {
        versions.push(variantVersionId);
        await env.MODS_KV.put(key, JSON.stringify(versions));
    }
}

/**
 * Get all versions for a variant (full metadata)
 */
export async function getVariantVersions(
    variantId: string,
    customerId: string | null,
    env: Env
): Promise<VariantVersion[]> {
    const versionIds = await getVariantVersionIds(variantId, customerId, env);
    const versions: VariantVersion[] = [];
    
    for (const versionId of versionIds) {
        const version = await getVariantVersion(versionId, customerId, env);
        if (version) {
            versions.push(version);
        }
    }
    
    // Sort by semantic version (newest first)
    versions.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || 0;
            const bPart = bParts[i] || 0;
            if (aPart !== bPart) {
                return bPart - aPart;
            }
        }
        return 0;
    });
    
    return versions;
}

/**
 * Get variant metadata from KV
 */
export async function getVariant(
    variantId: string,
    customerId: string | null,
    env: Env
): Promise<ModVariant | null> {
    const key = getCustomerKey(customerId, `variant_${variantId}`);
    return await env.MODS_KV.get(key, { type: 'json' }) as ModVariant | null;
}

/**
 * Save variant metadata to KV
 */
export async function saveVariant(
    variant: ModVariant,
    customerId: string | null,
    env: Env
): Promise<void> {
    const key = getCustomerKey(customerId, `variant_${variant.variantId}`);
    await env.MODS_KV.put(key, JSON.stringify(variant));
}

/**
 * Update variant metadata after new version upload
 */
export async function updateVariantAfterVersionUpload(
    variantId: string,
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    const variant = await getVariant(variantId, customerId, env);
    if (!variant) {
        console.error('[VariantVersions] Cannot update non-existent variant:', variantId);
        return;
    }
    
    // Update variant metadata
    variant.currentVersionId = variantVersionId;
    variant.versionCount += 1;
    variant.updatedAt = new Date().toISOString();
    
    await saveVariant(variant, customerId, env);
}

/**
 * Increment variant version download count
 */
export async function incrementVariantVersionDownloads(
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    const version = await getVariantVersion(variantVersionId, customerId, env);
    if (!version) {
        console.error('[VariantVersions] Cannot increment downloads for non-existent version:', variantVersionId);
        return;
    }
    
    version.downloads += 1;
    await saveVariantVersion(version, customerId, env);
}

/**
 * Increment variant total download count
 */
export async function incrementVariantTotalDownloads(
    variantId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    const variant = await getVariant(variantId, customerId, env);
    if (!variant) {
        console.error('[VariantVersions] Cannot increment downloads for non-existent variant:', variantId);
        return;
    }
    
    variant.totalDownloads += 1;
    await saveVariant(variant, customerId, env);
}

/**
 * Get R2 key for variant version file
 * ARCHITECTURAL IMPROVEMENT: Consistent hierarchy - all variant versions under variants/{variantId}/versions/
 */
export function getVariantVersionR2Key(
    modId: string,
    variantId: string,
    variantVersionId: string,
    extension: string,
    customerId: string | null
): string {
    // Remove 'mod_' prefix if present
    const normalizedModId = modId.startsWith('mod_') ? modId.substring(4) : modId;
    
    return getCustomerR2Key(
        customerId,
        `${normalizedModId}/variants/${variantId}/versions/${variantVersionId}.${extension}`
    );
}

/**
 * Check if variant version exists
 */
export async function variantVersionExists(
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<boolean> {
    const version = await getVariantVersion(variantVersionId, customerId, env);
    return !!version;
}

/**
 * Delete variant version (marks for deletion, actual file cleanup happens via cron)
 */
export async function deleteVariantVersion(
    variantVersionId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    const version = await getVariantVersion(variantVersionId, customerId, env);
    if (!version) {
        console.warn('[VariantVersions] Cannot delete non-existent version:', variantVersionId);
        return;
    }
    
    // Mark R2 file for deletion (add metadata for cleanup cron)
    try {
        const file = await env.MODS_R2.get(version.r2Key);
        if (file) {
            // Copy file with deletion metadata
            await env.MODS_R2.put(version.r2Key, file.body, {
                httpMetadata: file.httpMetadata,
                customMetadata: {
                    ...file.customMetadata,
                    markedForDeletion: 'true',
                    deletionMarkedAt: new Date().toISOString()
                }
            });
        }
    } catch (error) {
        console.error('[VariantVersions] Error marking file for deletion:', error);
    }
    
    // Remove version from KV
    const key = getCustomerKey(customerId, `variant_version_${variantVersionId}`);
    await env.MODS_KV.delete(key);
    
    // Remove from variant's version list
    const variantId = version.variantId;
    const versionIds = await getVariantVersionIds(variantId, customerId, env);
    const updatedVersionIds = versionIds.filter(id => id !== variantVersionId);
    
    const versionsListKey = getCustomerKey(customerId, `variant_${variantId}_versions`);
    await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionIds));
    
    // Update variant metadata
    const variant = await getVariant(variantId, customerId, env);
    if (variant) {
        variant.versionCount = Math.max(0, variant.versionCount - 1);
        variant.updatedAt = new Date().toISOString();
        
        // If this was the current version, update to latest remaining version
        if (variant.currentVersionId === variantVersionId && updatedVersionIds.length > 0) {
            const remainingVersions = await getVariantVersions(variantId, customerId, env);
            if (remainingVersions.length > 0) {
                variant.currentVersionId = remainingVersions[0].variantVersionId;
            }
        }
        
        await saveVariant(variant, customerId, env);
    }
}

/**
 * Environment interface
 */
interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    [key: string]: any;
}
