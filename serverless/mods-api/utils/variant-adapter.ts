/**
 * Variant system adapters
 * 
 * Provides conversion between mod-specific types and agnostic variant types.
 * This allows the codebase to gradually migrate to the agnostic system
 * while maintaining backward compatibility.
 */

import type { Variant, VariantReference, VersionedResource } from '../../shared/types/variant.js';
import type { ModVariant, ModVersion } from '../types/mod.js';

/**
 * Convert ModVariant to agnostic Variant + VariantReference
 */
export function toAgnosticVariant(modVariant: ModVariant): {
    variant: Variant;
    reference: VariantReference;
} {
    const { modId, versionCount, totalDownloads, ...rest } = modVariant;
    
    return {
        variant: {
            ...rest,
            metadata: {
                versionCount: versionCount || 0,
                totalDownloads: totalDownloads || 0,
            },
        },
        reference: {
            variantId: modVariant.variantId,
            parentId: modId,
            parentType: 'mod',
        },
    };
}

/**
 * Convert agnostic Variant + VariantReference to ModVariant
 */
export function fromAgnosticVariant(
    variant: Variant,
    reference: VariantReference,
    stats?: { versionCount: number; totalDownloads: number }
): ModVariant {
    return {
        variantId: variant.variantId,
        modId: reference.parentId || '',
        name: variant.name,
        description: variant.description,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        currentVersionId: variant.currentVersionId || null,
        versionCount: stats?.versionCount || variant.metadata?.versionCount || 0,
        totalDownloads: stats?.totalDownloads || variant.metadata?.totalDownloads || 0,
    };
}

/**
 * Convert ModVersion to agnostic VersionedResource
 */
export function toAgnosticVersion(modVersion: ModVersion): VersionedResource {
    const { modId, r2Key, gameVersions, dependencies, ...rest } = modVersion;
    
    return {
        ...rest,
        resourceId: modId,
        storageKey: r2Key,
        metadata: {
            gameVersions,
            dependencies,
        },
    };
}

/**
 * Convert agnostic VersionedResource to ModVersion
 */
export function fromAgnosticVersion(versionedResource: VersionedResource): ModVersion {
    const { resourceId, storageKey, metadata, ...rest } = versionedResource;
    
    return {
        ...rest,
        modId: resourceId,
        r2Key: storageKey,
        gameVersions: metadata?.gameVersions || [],
        dependencies: metadata?.dependencies,
    };
}

/**
 * Check if a ModVersion is a variant version
 */
export function isVariantVersion(version: ModVersion): boolean {
    return version.variantId != null && version.variantId !== '';
}

/**
 * Check if a ModVersion is a main mod version
 */
export function isMainModVersion(version: ModVersion): boolean {
    return !isVariantVersion(version);
}

/**
 * Filter versions by variant
 */
export function filterVersionsByVariant(
    versions: ModVersion[],
    variantId: string | null
): ModVersion[] {
    if (variantId === null) {
        // Return only main mod versions (no variantId)
        return versions.filter(isMainModVersion);
    }
    
    // Return only versions for this specific variant
    return versions.filter(v => v.variantId === variantId);
}

/**
 * Get variant statistics from versions
 */
export function calculateVariantStats(
    variantId: string,
    versions: ModVersion[]
): { versionCount: number; totalDownloads: number } {
    const variantVersions = filterVersionsByVariant(versions, variantId);
    
    return {
        versionCount: variantVersions.length,
        totalDownloads: variantVersions.reduce((sum, v) => sum + v.downloads, 0),
    };
}

/**
 * Enrich ModVariant with computed stats from versions
 */
export function enrichVariantWithStats(
    variant: ModVariant,
    versions: ModVersion[]
): ModVariant {
    const stats = calculateVariantStats(variant.variantId, versions);
    
    return {
        ...variant,
        versionCount: stats.versionCount,
        totalDownloads: stats.totalDownloads,
    };
}

/**
 * Enrich multiple ModVariants with computed stats
 */
export function enrichVariantsWithStats(
    variants: ModVariant[],
    versions: ModVersion[]
): ModVariant[] {
    return variants.map(v => enrichVariantWithStats(v, versions));
}
