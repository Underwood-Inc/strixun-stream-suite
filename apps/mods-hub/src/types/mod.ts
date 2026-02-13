/**
 * Mod data types matching the API
 */

export type ModCategory = 
    | 'script'
    | 'overlay'
    | 'theme'
    | 'asset'
    | 'plugin'
    | 'other';

export type ModVisibility = 'public' | 'unlisted' | 'private';

export interface ModDependency {
    modId: string;
    version?: string;
    required: boolean;
}

export type ModStatus = 
    | 'pending'
    | 'approved'
    | 'changes_requested'
    | 'denied'
    | 'draft'
    | 'published'
    | 'archived';

export interface ModStatusHistory {
    status: ModStatus;
    changedBy: string; // Customer ID from OTP auth service
    changedByDisplayName?: string | null; // Display name (never use email)
    changedAt: string;
    reason?: string;
    // CRITICAL: changedByEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModReviewComment {
    commentId: string;
    authorId: string; // Customer ID from OTP auth service
    authorDisplayName?: string | null; // Display name (never use email)
    content: string;
    createdAt: string;
    isAdmin: boolean;
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModMetadata {
    modId: string;
    slug: string; // URL-friendly slug derived from title
    authorId: string; // Customer ID from OTP auth service (used for display name lookups)
    authorDisplayName?: string | null; // Display name fetched dynamically from auth API (always fresh, fallback only)
    title: string;
    summary?: string; // Short summary for list/card views (max ~150 chars)
    description: string; // Full markdown description for detail page
    category: ModCategory;
    tags: string[];
    thumbnailUrl?: string;
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: ModVisibility;
    featured: boolean;
    customerId: string | null; // Customer ID for data scoping (REQUIRED - set automatically if missing)
    status: ModStatus;
    statusHistory?: ModStatusHistory[];
    reviewComments?: ModReviewComment[];
    variants?: ModVariant[]; // Variants for the mod
    gameId?: string; // Associated game ID (sub-category)
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
    // CRITICAL: authorDisplayName is fetched dynamically from the Customer API on every API call
    // This ensures display names stay current when customers change them
    // The stored value is a fallback only if the fetch fails
    // CRITICAL: customerId is required for proper data scoping and is set automatically if missing
}

export interface ModVersion {
    versionId: string;
    modId: string;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    r2Key: string;
    downloadUrl: string;
    sha256: string; // SHA-256 hash of file (Strixun verified)
    createdAt: string;
    downloads: number;
    gameVersions: string[];
    dependencies?: ModDependency[];
}

export interface ModListResponse {
    mods: ModMetadata[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ModDetailResponse {
    mod: ModMetadata;
    versions: ModVersion[];
}

/**
 * Mod variant (metadata only - files are in VariantVersion)
 * ARCHITECTURAL IMPROVEMENT: Variants now support full version control
 */
/**
 * Mod variant (uses agnostic variant system)
 * 
 * This maintains backward compatibility while internally using the agnostic
 * Variant type. The modId field is kept for convenience.
 */
export interface ModVariant {
    variantId: string;
    modId: string; // Parent mod ID (for backward compatibility)
    parentVersionId: string; // Parent mod version ID - variants are tied to specific mod versions
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    currentVersionId: string | null; // Points to latest VariantVersion (null if no versions yet)
    versionCount: number; // Total number of versions
    totalDownloads: number; // Cumulative downloads across all versions
    fileName?: string; // Current version's fileName (populated from VariantVersion)
    // REMOVED: fileUrl, r2Key, fileSize, downloads
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
 * Legacy variant format for uploads (will be converted to proper VariantVersion)
 */
export interface ModVariantUpload {
    name: string;
    description?: string;
    file?: File; // For uploads
    version?: string;
    changelog?: string;
    gameVersions?: string[];
    dependencies?: ModDependency[];
}

export interface ModUploadRequest {
    title: string;
    summary?: string;
    description: string;
    category: ModCategory;
    tags: string[];
    version: string;
    changelog: string;
    gameVersions: string[];
    dependencies?: ModDependency[];
    visibility: ModVisibility;
    thumbnail?: string;
    status?: ModStatus; // Allow setting status (e.g., 'draft')
    variants?: ModVariant[]; // Variants for the mod
    gameId?: string; // Associated game ID (sub-category)
    displayName?: string; // Display name from auth store - avoids extra API calls
}

export interface ModUpdateRequest {
    title?: string;
    summary?: string;
    description?: string;
    category?: ModCategory;
    tags?: string[];
    visibility?: ModVisibility;
    thumbnail?: string;
    status?: ModStatus; // Allow updating status (e.g., 'draft' to 'pending')
    variants?: ModVariant[]; // Update variants
    gameId?: string; // Associated game ID (sub-category)
    displayName?: string; // Display name from auth store - avoids extra API calls
}

export interface VersionUploadRequest {
    version: string;
    changelog: string;
    gameVersions: string[];
    dependencies?: ModDependency[];
}

export interface ModRating {
    ratingId: string;
    modId: string;
    customerId: string; // Customer ID from OTP auth service
    userDisplayName?: string | null; // Display name (never use email)
    rating: number; // 1-5
    comment?: string;
    createdAt: string;
    updatedAt?: string;
    // CRITICAL: userEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModRatingsResponse {
    ratings: ModRating[];
    averageRating: number;
    totalRatings: number;
}

export interface ModRatingRequest {
    rating: number; // 1-5
    comment?: string;
}

