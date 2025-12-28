/**
 * OTP Auth Service Upload File Size Limits Configuration
 * 
 * This module provides service-specific upload limits for the otp-auth-service.
 * It uses the base limits from the shared API framework (10 MB default).
 * 
 * Limits:
 * - Profile pictures: 5 MB (uses default from shared framework)
 */

import {
    DEFAULT_UPLOAD_LIMITS,
    formatFileSize,
    validateFileSize,
} from '@strixun/api-framework';

/**
 * Maximum file size for profile picture uploads
 * Default: 5 MB (5 * 1024 * 1024 bytes)
 * 
 * Profile pictures should be reasonably sized images. This uses the default
 * from the shared framework.
 */
export const MAX_PROFILE_PICTURE_SIZE = DEFAULT_UPLOAD_LIMITS.maxProfilePictureSize; // 5 MB

// Re-export utilities from shared framework for convenience
export { formatFileSize, validateFileSize };
