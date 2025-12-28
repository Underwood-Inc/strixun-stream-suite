/**
 * Shared Upload File Size Limits Configuration
 * 
 * This module provides configurable upload file size limits that can be used
 * across all services using the shared API framework.
 * 
 * Features:
 * - Base default limit of 10 MB for all uploads
 * - Service-specific overrides
 * - Automatic validation utilities
 * - Human-readable error messages
 */

/**
 * Base upload file size limit (default for all services)
 * Default: 10 MB (10 * 1024 * 1024 bytes)
 * 
 * This is the maximum file size allowed by default. Services can override
 * this limit by providing their own configuration.
 */
export const BASE_UPLOAD_LIMIT = 10 * 1024 * 1024; // 10 MB

/**
 * Upload limits configuration interface
 * 
 * Services can provide this configuration to override the base limits
 */
export interface UploadLimitsConfig {
    /** Maximum file size for general file uploads (default: BASE_UPLOAD_LIMIT) */
    maxFileSize?: number;
    /** Maximum file size for thumbnail images (default: 1 MB) */
    maxThumbnailSize?: number;
    /** Maximum file size for profile pictures (default: 5 MB) */
    maxProfilePictureSize?: number;
    /** Maximum file size for cloud saves (default: BASE_UPLOAD_LIMIT) */
    maxCloudSaveSize?: number;
}

/**
 * Default upload limits configuration
 * Uses BASE_UPLOAD_LIMIT for most uploads
 */
export const DEFAULT_UPLOAD_LIMITS: Required<UploadLimitsConfig> = {
    maxFileSize: BASE_UPLOAD_LIMIT,
    maxThumbnailSize: 1 * 1024 * 1024, // 1 MB
    maxProfilePictureSize: 5 * 1024 * 1024, // 5 MB
    maxCloudSaveSize: BASE_UPLOAD_LIMIT,
};

/**
 * Get upload limits with service-specific overrides
 * 
 * @param overrides - Service-specific limit overrides
 * @returns Complete upload limits configuration
 */
export function getUploadLimits(overrides?: UploadLimitsConfig): Required<UploadLimitsConfig> {
    return {
        maxFileSize: overrides?.maxFileSize ?? DEFAULT_UPLOAD_LIMITS.maxFileSize,
        maxThumbnailSize: overrides?.maxThumbnailSize ?? DEFAULT_UPLOAD_LIMITS.maxThumbnailSize,
        maxProfilePictureSize: overrides?.maxProfilePictureSize ?? DEFAULT_UPLOAD_LIMITS.maxProfilePictureSize,
        maxCloudSaveSize: overrides?.maxCloudSaveSize ?? DEFAULT_UPLOAD_LIMITS.maxCloudSaveSize,
    };
}

/**
 * Format file size in bytes to human-readable string
 * 
 * @param bytes - File size in bytes
 * @returns Human-readable file size string (e.g., "10 MB")
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}

/**
 * Validate file size against a limit
 * 
 * @param fileSize - Size of the file in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @returns Object with valid flag and optional error message
 */
export function validateFileSize(fileSize: number, maxSize: number): { valid: boolean; error?: string } {
    if (fileSize > maxSize) {
        return {
            valid: false,
            error: `File size (${formatFileSize(fileSize)}) exceeds maximum allowed size of ${formatFileSize(maxSize)}`
        };
    }
    return { valid: true };
}

/**
 * Create a file size validator function for a specific limit
 * 
 * @param maxSize - Maximum allowed size in bytes
 * @returns Validator function that takes a file size and returns validation result
 */
export function createFileSizeValidator(maxSize: number) {
    return (fileSize: number) => validateFileSize(fileSize, maxSize);
}

