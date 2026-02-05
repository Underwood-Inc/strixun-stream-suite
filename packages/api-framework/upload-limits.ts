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
    /** Maximum file size for inline images in rich text (default: 500 KB) */
    maxInlineImageSize?: number;
    /** Maximum total payload size for rich text content with embedded media (default: 5 MB) */
    maxRichTextPayloadSize?: number;
    /** 
     * @deprecated No longer enforced. Use maxRichTextPayloadSize for size-based limits.
     * Only uploaded images count toward size limits; external URLs are free.
     */
    maxInlineImageCount?: number;
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
    maxInlineImageSize: 512 * 1024, // 512 KB per inline image
    maxRichTextPayloadSize: 5 * 1024 * 1024, // 5 MB total for rich text with embedded media
    maxInlineImageCount: 10, // Max 10 inline images per description
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
        maxInlineImageSize: overrides?.maxInlineImageSize ?? DEFAULT_UPLOAD_LIMITS.maxInlineImageSize,
        maxRichTextPayloadSize: overrides?.maxRichTextPayloadSize ?? DEFAULT_UPLOAD_LIMITS.maxRichTextPayloadSize,
        maxInlineImageCount: overrides?.maxInlineImageCount ?? DEFAULT_UPLOAD_LIMITS.maxInlineImageCount,
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

/**
 * Rich text payload validation result
 */
export interface RichTextPayloadValidation {
    valid: boolean;
    totalSize: number;
    imageCount: number;
    errors: string[];
}

/**
 * Embedded media info for rich text content
 */
export interface EmbeddedMediaInfo {
    type: 'image' | 'video';
    size: number; // Size in bytes (for images with data URIs) or 0 for external URLs
    url: string;
}

/**
 * Calculate the total payload size of rich text content
 * Includes text content and base64-encoded images
 * 
 * @param textContent - The text/markdown content
 * @param embeddedMedia - Array of embedded media info
 * @returns Total size in bytes
 */
export function calculateRichTextPayloadSize(
    textContent: string,
    embeddedMedia: EmbeddedMediaInfo[] = []
): number {
    // Text content size (UTF-8 encoded)
    const textSize = new TextEncoder().encode(textContent).length;
    
    // Sum of embedded media sizes
    const mediaSize = embeddedMedia.reduce((sum, media) => sum + media.size, 0);
    
    return textSize + mediaSize;
}

/**
 * Validate rich text content with embedded media
 * 
 * IMPORTANT: Only UPLOADED images (base64 data URIs) count toward size limits.
 * External image URLs (http/https) do NOT count toward the upload size limit.
 * There is NO hard limit on image count - only total uploaded size matters.
 * 
 * @param textContent - The text/markdown content
 * @param embeddedMedia - Array of embedded media info
 * @param limits - Upload limits configuration (uses defaults if not provided)
 * @returns Validation result with errors if any
 */
export function validateRichTextPayload(
    textContent: string,
    embeddedMedia: EmbeddedMediaInfo[] = [],
    limits: Partial<UploadLimitsConfig> = {}
): RichTextPayloadValidation {
    const config = getUploadLimits(limits);
    const errors: string[] = [];
    
    // Get all images
    const images = embeddedMedia.filter(m => m.type === 'image');
    const imageCount = images.length;
    
    // Filter to only UPLOADED images (base64 data URIs, not external URLs)
    // External URLs (http/https) don't count toward size limits
    const uploadedImages = images.filter(img => 
        img.url.startsWith('data:') && img.size > 0
    );
    
    // Validate individual uploaded image sizes only
    uploadedImages.forEach((img, index) => {
        if (img.size > config.maxInlineImageSize) {
            errors.push(
                `Uploaded image ${index + 1} (${formatFileSize(img.size)}) exceeds maximum size of ${formatFileSize(config.maxInlineImageSize)}`
            );
        }
    });
    
    // Calculate total payload size (text + uploaded media only)
    // External URLs don't contribute to payload size
    const textSize = new TextEncoder().encode(textContent).length;
    const uploadedMediaSize = uploadedImages.reduce((sum, img) => sum + img.size, 0);
    const totalSize = textSize + uploadedMediaSize;
    
    // Validate total uploaded payload size
    if (totalSize > config.maxRichTextPayloadSize) {
        errors.push(
            `Total uploaded content size (${formatFileSize(totalSize)}) exceeds maximum of ${formatFileSize(config.maxRichTextPayloadSize)}`
        );
    }
    
    return {
        valid: errors.length === 0,
        totalSize,
        imageCount, // Still report total count for informational purposes
        errors,
    };
}

