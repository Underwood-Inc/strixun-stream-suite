/**
 * Mod data types and interfaces
 */

/**
 * Mod metadata stored in KV
 */
export interface ModMetadata {
    modId: string;
    authorId: string;
    authorEmail: string;
    title: string;
    description: string;
    category: ModCategory;
    tags: string[];
    thumbnailUrl?: string;
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: ModVisibility;
    featured: boolean;
    customerId: string | null;
}

/**
 * Mod version metadata
 */
export interface ModVersion {
    versionId: string;
    modId: string;
    version: string; // Semantic version: "1.0.0"
    changelog: string;
    fileSize: number;
    fileName: string;
    r2Key: string; // R2 storage key
    downloadUrl: string; // Direct download URL
    createdAt: string;
    downloads: number;
    gameVersions: string[]; // Supported game versions
    dependencies?: ModDependency[];
}

/**
 * Mod dependency
 */
export interface ModDependency {
    modId: string;
    version?: string; // Optional version constraint
    required: boolean;
}

/**
 * Mod category
 */
export type ModCategory = 
    | 'script'
    | 'overlay'
    | 'theme'
    | 'asset'
    | 'plugin'
    | 'other';

/**
 * Mod visibility
 */
export type ModVisibility = 'public' | 'unlisted' | 'private';

/**
 * Mod upload request
 */
export interface ModUploadRequest {
    title: string;
    description: string;
    category: ModCategory;
    tags: string[];
    version: string;
    changelog: string;
    gameVersions: string[];
    dependencies?: ModDependency[];
    visibility: ModVisibility;
    thumbnail?: string; // Base64 encoded thumbnail
}

/**
 * Mod update request
 */
export interface ModUpdateRequest {
    title?: string;
    description?: string;
    category?: ModCategory;
    tags?: string[];
    visibility?: ModVisibility;
    thumbnail?: string;
}

/**
 * Version upload request
 */
export interface VersionUploadRequest {
    version: string;
    changelog: string;
    gameVersions: string[];
    dependencies?: ModDependency[];
}

/**
 * Mod list response
 */
export interface ModListResponse {
    mods: ModMetadata[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Mod detail response
 */
export interface ModDetailResponse {
    mod: ModMetadata;
    versions: ModVersion[];
}

