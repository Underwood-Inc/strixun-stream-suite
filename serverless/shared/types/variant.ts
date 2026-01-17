/**
 * AGNOSTIC VARIANT SYSTEM
 * 
 * Variants are generic, reusable entities that can represent different variations
 * of ANY resource (mods, assets, plugins, etc.). They are NOT tied to any specific system.
 * 
 * ARCHITECTURE:
 * - Variants are standalone entities identified by variantId
 * - Resources (mods, etc.) reference variants via variantIds, NOT embed them
 * - Variant versions use the unified version system (ModVersion with variantId)
 * - This allows variants to be shared, reused, or moved between resources
 */

/**
 * Variant metadata - standalone, agnostic entity
 * 
 * This represents a variation of something (e.g., Fabric vs Forge, Lite vs Full).
 * It is NOT tied to any specific resource - resources reference it via variantId.
 */
export interface Variant {
    /** Unique identifier for this variant */
    variantId: string;
    
    /** Display name (e.g., "Fabric", "Forge", "Lite", "Full") */
    name: string;
    
    /** Optional description explaining this variant */
    description?: string;
    
    /** When this variant was created */
    createdAt: string;
    
    /** When this variant was last modified */
    updatedAt: string;
    
    /** 
     * Optional pointer to the latest version for this variant
     * This is a convenience field - the source of truth is in the version system
     */
    currentVersionId?: string | null;
    
    /**
     * Optional metadata for extensibility
     * Systems can add custom fields here without modifying the core type
     */
    metadata?: Record<string, any>;
}

/**
 * Variant reference - how resources link to variants
 * 
 * Resources (mods, assets, etc.) store these references instead of embedding
 * the full variant data. This allows variants to be updated independently.
 */
export interface VariantReference {
    /** The variant being referenced */
    variantId: string;
    
    /** 
     * Optional: The parent resource this variant belongs to
     * For mods, this would be modId
     * For other systems, this could be assetId, pluginId, etc.
     * 
     * This is OPTIONAL to maintain flexibility - some systems may not need
     * explicit parent relationships (e.g., shared/global variants)
     */
    parentId?: string;
    
    /**
     * Optional: Type of the parent resource
     * For mods: "mod"
     * For other systems: "asset", "plugin", etc.
     * 
     * This allows multi-tenant variant systems where a single variant
     * could theoretically be used across different resource types
     */
    parentType?: string;
    
    /**
     * When this reference was created (when variant was added to parent)
     */
    addedAt?: string;
}

/**
 * Version with variant support
 * 
 * This is a generic version type that can represent:
 * - Main resource versions (variantId = null)
 * - Variant versions (variantId set)
 * 
 * The same version system is used for both, just with an optional variantId field.
 */
export interface VersionedResource {
    /** Unique identifier for this version */
    versionId: string;
    
    /** 
     * Parent resource identifier
     * For mods: modId
     * For other systems: whatever makes sense
     */
    resourceId: string;
    
    /**
     * Optional variant identifier
     * - null/undefined: This is a main resource version
     * - set: This is a version for a specific variant
     */
    variantId?: string | null;
    
    /** Semantic version (e.g., "1.0.0", "2.1.3") */
    version: string;
    
    /** What changed in this version */
    changelog: string;
    
    /** File information */
    fileSize: number;
    fileName: string;
    
    /** Storage location (R2, S3, etc.) */
    storageKey: string;
    
    /** Download URL */
    downloadUrl: string;
    
    /** File integrity hash */
    sha256: string;
    
    /** When this version was created */
    createdAt: string;
    
    /** Download statistics */
    downloads: number;
    
    /**
     * Optional metadata for extensibility
     * Systems can add custom fields here (e.g., gameVersions, dependencies)
     */
    metadata?: Record<string, any>;
}

/**
 * Helper type: Variant with parent context (for display/API responses)
 * 
 * This is what APIs might return when fetching variants for a specific resource.
 * It combines the standalone Variant with the reference context.
 */
export interface VariantWithContext extends Variant {
    /** The parent resource this variant belongs to (if applicable) */
    parentId?: string;
    
    /** The type of parent resource (if applicable) */
    parentType?: string;
    
    /** When this variant was added to the parent (if applicable) */
    addedAt?: string;
    
    /** Current version summary (convenience field) */
    currentVersion?: {
        versionId: string;
        version: string;
        fileSize: number;
        fileName: string;
        downloads: number;
    } | null;
    
    /** Version statistics (convenience field) */
    stats?: {
        versionCount: number;
        totalDownloads: number;
    };
}

/**
 * ModVariant - Extended Variant for Mods API
 * 
 * This type adapter allows existing code to work during migration.
 */
export interface ModVariant extends Variant {
    /** Parent mod ID */
    modId: string;
    
    /** Parent mod version ID - variants are tied to specific mod versions */
    parentVersionId: string;
    
    /** Included for backward compatibility with existing queries */
    versionCount?: number;
    totalDownloads?: number;
}

/**
 * Helper: Convert ModVariant to agnostic Variant + VariantReference
 */
export function splitModVariant(modVariant: ModVariant): {
    variant: Variant;
    reference: VariantReference;
} {
    const { modId, parentVersionId, versionCount, totalDownloads, ...variantFields } = modVariant;
    
    return {
        variant: {
            ...variantFields,
            metadata: {
                versionCount,
                totalDownloads,
                parentVersionId,
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
 * Helper: Convert Variant + VariantReference back to ModVariant (for backward compatibility)
 */
export function joinToModVariant(
    variant: Variant,
    reference: VariantReference,
    stats?: { versionCount: number; totalDownloads: number },
    parentVersionId?: string
): ModVariant {
    return {
        ...variant,
        modId: reference.parentId || '',
        parentVersionId: parentVersionId || variant.metadata?.parentVersionId || '',
        versionCount: stats?.versionCount || variant.metadata?.versionCount || 0,
        totalDownloads: stats?.totalDownloads || variant.metadata?.totalDownloads || 0,
    };
}
