/**
 * R2 File Storage Types
 * Type definitions for R2 file management operations
 */

export interface R2FileAssociatedMod {
    modId: string;
    title: string;
    slug: string;
    authorId: string;
    authorDisplayName?: string | null;
    description: string;
    category: string;
    status: string;
    customerId: string | null;
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: string;
    featured: boolean;
}

export interface R2FileAssociatedVersion {
    versionId: string;
    modId: string;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    sha256: string;
    createdAt: string;
    downloads: number;
    gameVersions: string[];
    dependencies?: Array<{ modId: string; version?: string; required: boolean }>;
}

export interface R2FileAssociatedCustomer {
    customerId: string;
    displayName?: string | null;
}

export interface R2FileAssociatedData {
    mod?: R2FileAssociatedMod;
    version?: R2FileAssociatedVersion;
    uploadedBy?: R2FileAssociatedCustomer;
    isThumbnail?: boolean;
    isModFile?: boolean;
}

export interface R2FileInfo {
    key: string;
    size: number;
    uploaded: Date;
    contentType?: string;
    customMetadata?: Record<string, string>;
    isOrphaned?: boolean;
    associatedModId?: string;
    associatedVersionId?: string;
    associatedData?: R2FileAssociatedData;
}
