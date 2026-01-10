/**
 * Frontend variant types (mirror of agnostic backend types)
 */

/**
 * Agnostic variant - represents a variation of any resource
 */
export interface Variant {
    variantId: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    currentVersionId?: string | null;
    metadata?: Record<string, any>;
}

/**
 * Variant reference - how resources link to variants
 */
export interface VariantReference {
    variantId: string;
    parentId?: string;
    parentType?: string;
    addedAt?: string;
}

/**
 * Versioned resource - generic version with variant support
 */
export interface VersionedResource {
    versionId: string;
    resourceId: string;
    variantId?: string | null;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    storageKey: string;
    downloadUrl: string;
    sha256: string;
    createdAt: string;
    downloads: number;
    metadata?: Record<string, any>;
}

/**
 * Variant with context - used in API responses
 */
export interface VariantWithContext extends Variant {
    parentId?: string;
    parentType?: string;
    addedAt?: string;
    currentVersion?: {
        versionId: string;
        version: string;
        fileSize: number;
        fileName: string;
        downloads: number;
    } | null;
    stats?: {
        versionCount: number;
        totalDownloads: number;
    };
}
