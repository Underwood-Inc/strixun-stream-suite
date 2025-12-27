/**
 * Mod data types and interfaces
 */

/**
 * Mod metadata stored in KV
 */
/**
 * Mod review status (similar to GitHub PR statuses)
 */
export type ModStatus = 
    | 'pending'      // Awaiting review
    | 'approved'     // Approved for publication
    | 'changes_requested' // Changes requested by admin
    | 'denied'       // Denied/rejected
    | 'draft'        // Draft (not ready for review)
    | 'published'    // Published and visible
    | 'archived';    // Archived

export interface ModMetadata {
    modId: string;
    slug: string; // URL-friendly slug derived from title
    authorId: string;
    authorEmail: string;
    authorDisplayName?: string | null; // Randomly generated username/display name
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
    status: ModStatus; // Review/triage status
    statusHistory?: ModStatusHistory[]; // History of status changes
    reviewComments?: ModReviewComment[]; // Comments from admins/uploader
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
    sha256: string; // SHA-256 hash of file (Strixun verified)
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
 * Mod status history entry
 */
export interface ModStatusHistory {
    status: ModStatus;
    changedBy: string; // User ID who changed the status
    changedByEmail?: string;
    changedAt: string;
    reason?: string; // Optional reason for status change
}

/**
 * Mod review comment
 */
export interface ModReviewComment {
    commentId: string;
    authorId: string;
    authorEmail: string;
    content: string;
    createdAt: string;
    isAdmin: boolean; // True if comment is from admin
}

/**
 * Mod detail response
 */
export interface ModDetailResponse {
    mod: ModMetadata;
    versions: ModVersion[];
}

