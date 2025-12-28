/**
 * Mods API Upload File Size Limits Configuration
 * 
 * This module provides service-specific upload limits for the mods-api service.
 * It extends the base limits from the shared API framework with mods-api specific overrides.
 * 
 * Limits:
 * - Mod uploads: 35 MB (overrides base 10 MB limit)
 * - Version uploads: 35 MB (overrides base 10 MB limit)
 * - Thumbnails: 1 MB (uses default from shared framework)
 */

import {
    BASE_UPLOAD_LIMIT,
    DEFAULT_UPLOAD_LIMITS,
    formatFileSize,
    validateFileSize,
} from '@strixun/api-framework';

/**
 * Maximum file size for mod uploads (encrypted)
 * Default: 35 MB (35 * 1024 * 1024 bytes)
 * 
 * This overrides the base 10 MB limit for mod uploads specifically.
 * This is the maximum size for the encrypted mod file as uploaded by the client.
 */
export const MAX_MOD_FILE_SIZE = 35 * 1024 * 1024; // 35 MB

/**
 * Maximum file size for mod version uploads (encrypted)
 * Default: 35 MB (35 * 1024 * 1024 bytes)
 * 
 * This overrides the base 10 MB limit for version uploads specifically.
 * This is the maximum size for the encrypted version file as uploaded by the client.
 */
export const MAX_VERSION_FILE_SIZE = 35 * 1024 * 1024; // 35 MB

/**
 * Maximum file size for thumbnail images
 * Default: 1 MB (1 * 1024 * 1024 bytes)
 * 
 * Thumbnails should be optimized images. Supported formats: PNG, WebP, GIF, JPEG.
 * This uses the default from the shared framework.
 */
export const MAX_THUMBNAIL_SIZE = DEFAULT_UPLOAD_LIMITS.maxThumbnailSize; // 1 MB

// Re-export utilities from shared framework for convenience
// These are already available from @strixun/api-framework, but re-exported for local convenience
export { formatFileSize, validateFileSize };
