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
    authorId: string; // userId from OTP auth service (used for display name lookups)
    authorDisplayName?: string | null; // Display name fetched dynamically from auth API (always fresh, fallback only)
    title: string;
    description: string;
    category: ModCategory;
    tags: string[];
    thumbnailUrl?: string;
    thumbnailExtension?: string; // Extension stored for faster lookup (png, jpg, jpeg, webp, gif)
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: ModVisibility;
    featured: boolean;
    customerId: string | null; // Customer ID for data scoping (REQUIRED - set automatically if missing)
    status: ModStatus; // Review/triage status
    statusHistory?: ModStatusHistory[]; // History of status changes
    reviewComments?: ModReviewComment[]; // Comments from admins/uploader
    variants?: ModVariant[]; // Variants for the mod
    gameId?: string; // Associated game ID (sub-category)
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
    // CRITICAL: authorDisplayName is fetched dynamically from /auth/user/:userId on every API call
    // This ensures display names stay current when users change them
    // The stored value is a fallback only if the fetch fails
    // CRITICAL: customerId is required for proper data scoping and is set automatically if missing
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
    variants?: ModVariant[];
    gameId?: string;
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
    changedByDisplayName?: string | null; // Display name (never use email)
    changedAt: string;
    reason?: string; // Optional reason for status change
    // CRITICAL: changedByEmail is NOT stored - email is ONLY for OTP authentication
}

/**
 * Mod review comment
 */
export interface ModReviewComment {
    commentId: string;
    authorId: string; // User ID from OTP auth service
    authorDisplayName?: string | null; // Display name (never use email)
    content: string;
    createdAt: string;
    isAdmin: boolean; // True if comment is from admin
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
}

/**
 * Mod variant
 */
export interface ModVariant {
    variantId: string;
    name: string;
    description?: string;
    fileUrl?: string; // For existing variants
    fileName?: string;
    fileSize?: number;
    version?: string;
    changelog?: string;
    gameVersions?: string[];
    dependencies?: ModDependency[];
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Mod detail response
 */
export interface ModDetailResponse {
    mod: ModMetadata;
    versions: ModVersion[];
}

