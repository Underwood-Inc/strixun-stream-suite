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
    changedBy: string; // User ID from OTP auth service
    changedByDisplayName?: string | null; // Display name (never use email)
    changedAt: string;
    reason?: string;
    // CRITICAL: changedByEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModReviewComment {
    commentId: string;
    authorId: string; // User ID from OTP auth service
    authorDisplayName?: string | null; // Display name (never use email)
    content: string;
    createdAt: string;
    isAdmin: boolean;
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModMetadata {
    modId: string;
    slug: string; // URL-friendly slug derived from title
    authorId: string; // User ID from OTP auth service
    authorDisplayName?: string | null; // Display name from customer account (never use email)
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
    customerId: string | null; // Customer ID for data scoping (from OTP auth)
    status: ModStatus;
    statusHistory?: ModStatusHistory[];
    reviewComments?: ModReviewComment[];
    variants?: ModVariant[]; // Variants for the mod
    gameId?: string; // Associated game ID (sub-category)
    // CRITICAL: authorEmail is NOT stored - email is ONLY for OTP authentication
    // Use authorId to lookup displayName via /auth/user/:userId if needed
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

export interface ModVariant {
    variantId: string;
    name: string;
    description?: string;
    file?: File; // For uploads
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
    thumbnail?: string;
    status?: ModStatus; // Allow setting status (e.g., 'draft')
    variants?: ModVariant[]; // Variants for the mod
    gameId?: string; // Associated game ID (sub-category)
}

export interface ModUpdateRequest {
    title?: string;
    description?: string;
    category?: ModCategory;
    tags?: string[];
    visibility?: ModVisibility;
    thumbnail?: string;
    status?: ModStatus; // Allow updating status (e.g., 'draft' to 'pending')
    variants?: ModVariant[]; // Update variants
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
    userId: string; // User ID from OTP auth service
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

