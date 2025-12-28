/**
 * Unit Tests for Upload File Size Limits Configuration
 * 
 * Tests verify that upload limits work correctly:
 * - Base upload limit (10 MB)
 * - Default limits for different file types
 * - File size formatting (bytes, KB, MB, GB)
 * - File size validation
 * - Service-specific overrides
 * - Validator function creation
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
    BASE_UPLOAD_LIMIT,
    DEFAULT_UPLOAD_LIMITS,
    getUploadLimits,
    formatFileSize,
    validateFileSize,
    createFileSizeValidator,
    type UploadLimitsConfig,
} from './upload-limits.js';

describe('Upload Limits Configuration', () => {
    describe('BASE_UPLOAD_LIMIT', () => {
        it('should be 10 MB (10 * 1024 * 1024 bytes)', () => {
            expect(BASE_UPLOAD_LIMIT).toBe(10 * 1024 * 1024);
            expect(BASE_UPLOAD_LIMIT).toBe(10485760);
        });

        it('should be a number', () => {
            expect(typeof BASE_UPLOAD_LIMIT).toBe('number');
        });
    });

    describe('DEFAULT_UPLOAD_LIMITS', () => {
        it('should have all required properties', () => {
            expect(DEFAULT_UPLOAD_LIMITS).toHaveProperty('maxFileSize');
            expect(DEFAULT_UPLOAD_LIMITS).toHaveProperty('maxThumbnailSize');
            expect(DEFAULT_UPLOAD_LIMITS).toHaveProperty('maxProfilePictureSize');
            expect(DEFAULT_UPLOAD_LIMITS).toHaveProperty('maxCloudSaveSize');
        });

        it('should use BASE_UPLOAD_LIMIT for maxFileSize', () => {
            expect(DEFAULT_UPLOAD_LIMITS.maxFileSize).toBe(BASE_UPLOAD_LIMIT);
        });

        it('should use BASE_UPLOAD_LIMIT for maxCloudSaveSize', () => {
            expect(DEFAULT_UPLOAD_LIMITS.maxCloudSaveSize).toBe(BASE_UPLOAD_LIMIT);
        });

        it('should have 1 MB for maxThumbnailSize', () => {
            expect(DEFAULT_UPLOAD_LIMITS.maxThumbnailSize).toBe(1 * 1024 * 1024);
        });

        it('should have 5 MB for maxProfilePictureSize', () => {
            expect(DEFAULT_UPLOAD_LIMITS.maxProfilePictureSize).toBe(5 * 1024 * 1024);
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(512)).toBe('512 B');
            expect(formatFileSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1.0 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(5120)).toBe('5.0 KB');
            expect(formatFileSize(10240)).toBe('10.0 KB');
        });

        it('should format megabytes correctly', () => {
            expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
            expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
            expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
            expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
            expect(formatFileSize(35 * 1024 * 1024)).toBe('35.0 MB');
            expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB');
        });

        it('should format gigabytes correctly', () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
            expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
            expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
        });

        it('should handle edge cases', () => {
            expect(formatFileSize(1023)).toBe('1023 B');
            expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
            expect(formatFileSize(1024 * 1024 * 1024 - 1)).toBe('1024.0 MB');
        });
    });

    describe('validateFileSize', () => {
        it('should return valid for files under the limit', () => {
            const result = validateFileSize(5 * 1024 * 1024, 10 * 1024 * 1024);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return valid for files exactly at the limit', () => {
            const result = validateFileSize(10 * 1024 * 1024, 10 * 1024 * 1024);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should return invalid for files over the limit', () => {
            const result = validateFileSize(15 * 1024 * 1024, 10 * 1024 * 1024);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('exceeds maximum');
            expect(result.error).toContain('15.0 MB');
            expect(result.error).toContain('10.0 MB');
        });

        it('should handle zero byte files', () => {
            const result = validateFileSize(0, 10 * 1024 * 1024);
            expect(result.valid).toBe(true);
        });

        it('should handle very large files', () => {
            const result = validateFileSize(100 * 1024 * 1024, 10 * 1024 * 1024);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('100.0 MB');
        });

        it('should handle small limits', () => {
            const result = validateFileSize(2048, 1024);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('2.0 KB');
            expect(result.error).toContain('1.0 KB');
        });
    });

    describe('getUploadLimits', () => {
        it('should return default limits when no overrides provided', () => {
            const limits = getUploadLimits();
            expect(limits).toEqual(DEFAULT_UPLOAD_LIMITS);
        });

        it('should return default limits when empty overrides provided', () => {
            const limits = getUploadLimits({});
            expect(limits).toEqual(DEFAULT_UPLOAD_LIMITS);
        });

        it('should override maxFileSize when provided', () => {
            const overrides: UploadLimitsConfig = {
                maxFileSize: 50 * 1024 * 1024, // 50 MB
            };
            const limits = getUploadLimits(overrides);
            expect(limits.maxFileSize).toBe(50 * 1024 * 1024);
            expect(limits.maxThumbnailSize).toBe(DEFAULT_UPLOAD_LIMITS.maxThumbnailSize);
            expect(limits.maxProfilePictureSize).toBe(DEFAULT_UPLOAD_LIMITS.maxProfilePictureSize);
            expect(limits.maxCloudSaveSize).toBe(DEFAULT_UPLOAD_LIMITS.maxCloudSaveSize);
        });

        it('should override maxThumbnailSize when provided', () => {
            const overrides: UploadLimitsConfig = {
                maxThumbnailSize: 2 * 1024 * 1024, // 2 MB
            };
            const limits = getUploadLimits(overrides);
            expect(limits.maxThumbnailSize).toBe(2 * 1024 * 1024);
            expect(limits.maxFileSize).toBe(DEFAULT_UPLOAD_LIMITS.maxFileSize);
        });

        it('should override multiple limits when provided', () => {
            const overrides: UploadLimitsConfig = {
                maxFileSize: 50 * 1024 * 1024,
                maxThumbnailSize: 2 * 1024 * 1024,
                maxProfilePictureSize: 10 * 1024 * 1024,
            };
            const limits = getUploadLimits(overrides);
            expect(limits.maxFileSize).toBe(50 * 1024 * 1024);
            expect(limits.maxThumbnailSize).toBe(2 * 1024 * 1024);
            expect(limits.maxProfilePictureSize).toBe(10 * 1024 * 1024);
            expect(limits.maxCloudSaveSize).toBe(DEFAULT_UPLOAD_LIMITS.maxCloudSaveSize);
        });

        it('should override all limits when all provided', () => {
            const overrides: UploadLimitsConfig = {
                maxFileSize: 50 * 1024 * 1024,
                maxThumbnailSize: 2 * 1024 * 1024,
                maxProfilePictureSize: 10 * 1024 * 1024,
                maxCloudSaveSize: 20 * 1024 * 1024,
            };
            const limits = getUploadLimits(overrides);
            expect(limits.maxFileSize).toBe(50 * 1024 * 1024);
            expect(limits.maxThumbnailSize).toBe(2 * 1024 * 1024);
            expect(limits.maxProfilePictureSize).toBe(10 * 1024 * 1024);
            expect(limits.maxCloudSaveSize).toBe(20 * 1024 * 1024);
        });
    });

    describe('createFileSizeValidator', () => {
        it('should create a validator function for a specific limit', () => {
            const validator = createFileSizeValidator(10 * 1024 * 1024);
            expect(typeof validator).toBe('function');
        });

        it('should return valid for files under the limit', () => {
            const validator = createFileSizeValidator(10 * 1024 * 1024);
            const result = validator(5 * 1024 * 1024);
            expect(result.valid).toBe(true);
        });

        it('should return invalid for files over the limit', () => {
            const validator = createFileSizeValidator(10 * 1024 * 1024);
            const result = validator(15 * 1024 * 1024);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should work with different limits', () => {
            const validator1 = createFileSizeValidator(1 * 1024 * 1024);
            const validator2 = createFileSizeValidator(100 * 1024 * 1024);
            
            expect(validator1(512 * 1024).valid).toBe(true);
            expect(validator1(2 * 1024 * 1024).valid).toBe(false);
            
            expect(validator2(50 * 1024 * 1024).valid).toBe(true);
            expect(validator2(150 * 1024 * 1024).valid).toBe(false);
        });
    });
});

