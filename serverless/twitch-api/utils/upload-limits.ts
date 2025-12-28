/**
 * Twitch API Upload File Size Limits Configuration
 * 
 * This module provides service-specific upload limits for the twitch-api service.
 * It uses the base limits from the shared API framework (10 MB default).
 * 
 * Limits:
 * - Cloud saves: 10 MB (uses base limit from shared framework)
 */

import {
    BASE_UPLOAD_LIMIT,
    formatFileSize,
} from '@strixun/api-framework';

/**
 * Maximum file size for cloud save uploads (JSON stringified)
 * Default: 10 MB (10 * 1024 * 1024 bytes)
 * 
 * Cloudflare KV has a 25MB limit, but we use the base 10MB limit for safety.
 * This limit applies to the JSON stringified save data.
 */
export const MAX_CLOUD_SAVE_SIZE = BASE_UPLOAD_LIMIT; // 10 MB

// Re-export utilities from shared framework for convenience
export { formatFileSize };

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

