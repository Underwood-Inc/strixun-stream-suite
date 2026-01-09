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
    authorId: string; // customerId from OTP auth service (used for display name lookups) - CRITICAL: This is customerId, not userId!
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
    // CRITICAL: authorDisplayName is fetched dynamically from the Customer API on every API call
    // This ensures display names stay current when customers change them
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
    changedBy: string; // customer ID who changed the status
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
    authorId: string; // Customer ID from OTP auth service
    authorDisplayName?: string | null; // Display name (never use email)
    content: string;
    createdAt: string;
    isAdmin: boolean; // True if comment is from admin
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
}

/**
 * Mod variant (metadata only - files are in VariantVersion)
 * ARCHITECTURAL IMPROVEMENT: Variants now support full version control
 */
export interface ModVariant {
    variantId: string;
    modId: string; // Parent mod ID
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    currentVersionId: string | null; // Points to latest VariantVersion (null if no versions yet)
    versionCount: number; // Total number of versions
    totalDownloads: number; // Cumulative downloads across all versions
    fileName: string; // Current version's fileName (populated from VariantVersion)
    // REMOVED: fileUrl, r2Key, fileSize, version, changelog, gameVersions, dependencies, downloads
    // These fields now live in VariantVersion for proper version control
}

/**
 * Variant version metadata (for version control of variant files)
 * ARCHITECTURAL IMPROVEMENT: Each variant can now have multiple versions
 */
export interface VariantVersion {
    variantVersionId: string;
    variantId: string; // Parent variant ID
    modId: string; // Parent mod ID
    version: string; // Semantic version: "1.0.0"
    changelog: string;
    fileSize: number;
    fileName: string;
    r2Key: string; // R2 storage key
    downloadUrl: string;
    sha256: string; // SHA-256 hash of file (Strixun verified)
    createdAt: string;
    downloads: number;
    gameVersions?: string[];
    dependencies?: ModDependency[];
}

/**
 * Variant version upload request
 */
export interface VariantVersionUploadRequest {
    version: string;
    changelog: string;
    gameVersions?: string[];
    dependencies?: ModDependency[];
}

/**
 * Mod detail response
 */
export interface ModDetailResponse {
    mod: ModMetadata;
    versions: ModVersion[];
}

/**
 * Centralized Index Types
 * ARCHITECTURAL IMPROVEMENT: Centralized indexes for O(1) lookups
 */

/**
 * Slug index entry - maps slug to mod location
 */
export interface SlugIndexEntry {
    modId: string;
    customerId: string | null;
    slug: string;
    createdAt: string;
}

/**
 * Public mods index entry - tracks which mods are publicly visible
 */
export interface PublicModsIndexEntry {
    modId: string;
    customerId: string | null;
    status: ModStatus;
    featured: boolean;
    category: ModCategory;
    createdAt: string;
    updatedAt: string;
}

/**
 * Global slug index - single source of truth for all slugs
 * Key: slug_index
 * Value: Record<slug, SlugIndexEntry>
 */
export type SlugIndex = Record<string, SlugIndexEntry>;

/**
 * Global public mods index - single source of truth for public mods
 * Key: public_mods_index
 * Value: Record<modId, PublicModsIndexEntry>
 */
export type PublicModsIndex = Record<string, PublicModsIndexEntry>;
