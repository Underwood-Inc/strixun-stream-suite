/**
 * Unit Tests for Mods API Upload Limits
 * 
 * Tests verify that mods-api specific upload limits work correctly:
 * - Mod upload limit (35 MB override)
 * - Version upload limit (35 MB override)
 * - Thumbnail limit (1 MB from default)
 * - Integration with shared framework
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
    MAX_MOD_FILE_SIZE,
    MAX_VERSION_FILE_SIZE,
    MAX_THUMBNAIL_SIZE,
    formatFileSize,
    validateFileSize,
} from './upload-limits.js';
import {
    BASE_UPLOAD_LIMIT,
    DEFAULT_UPLOAD_LIMITS,
} from '@strixun/api-framework';

describe('Mods API Upload Limits', () => {
    describe('MAX_MOD_FILE_SIZE', () => {
        it('should be 35 MB (35 * 1024 * 1024 bytes)', () => {
            expect(MAX_MOD_FILE_SIZE).toBe(35 * 1024 * 1024);
            expect(MAX_MOD_FILE_SIZE).toBe(36700160);
        });

        it('should override the base 10 MB limit', () => {
            expect(MAX_MOD_FILE_SIZE).toBeGreaterThan(BASE_UPLOAD_LIMIT);
            expect(MAX_MOD_FILE_SIZE).toBe(3.5 * BASE_UPLOAD_LIMIT);
        });

        it('should be a number', () => {
            expect(typeof MAX_MOD_FILE_SIZE).toBe('number');
        });
    });

    describe('MAX_VERSION_FILE_SIZE', () => {
        it('should be 35 MB (35 * 1024 * 1024 bytes)', () => {
            expect(MAX_VERSION_FILE_SIZE).toBe(35 * 1024 * 1024);
            expect(MAX_VERSION_FILE_SIZE).toBe(36700160);
        });

        it('should match MAX_MOD_FILE_SIZE', () => {
            expect(MAX_VERSION_FILE_SIZE).toBe(MAX_MOD_FILE_SIZE);
        });

        it('should override the base 10 MB limit', () => {
            expect(MAX_VERSION_FILE_SIZE).toBeGreaterThan(BASE_UPLOAD_LIMIT);
        });
    });

    describe('MAX_THUMBNAIL_SIZE', () => {
        it('should be 1 MB (1 * 1024 * 1024 bytes)', () => {
            expect(MAX_THUMBNAIL_SIZE).toBe(1 * 1024 * 1024);
            expect(MAX_THUMBNAIL_SIZE).toBe(1048576);
        });

        it('should use the default from shared framework', () => {
            expect(MAX_THUMBNAIL_SIZE).toBe(DEFAULT_UPLOAD_LIMITS.maxThumbnailSize);
        });

        it('should be less than the base upload limit', () => {
            expect(MAX_THUMBNAIL_SIZE).toBeLessThan(BASE_UPLOAD_LIMIT);
        });
    });

    describe('Validation with Mod Limits', () => {
        it('should validate mod files under 35 MB', () => {
            const result = validateFileSize(30 * 1024 * 1024, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should validate mod files exactly at 35 MB', () => {
            const result = validateFileSize(35 * 1024 * 1024, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should reject mod files over 35 MB', () => {
            const result = validateFileSize(40 * 1024 * 1024, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('40.0 MB');
            expect(result.error).toContain('35.0 MB');
        });

        it('should validate version files under 35 MB', () => {
            const result = validateFileSize(30 * 1024 * 1024, MAX_VERSION_FILE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should reject version files over 35 MB', () => {
            const result = validateFileSize(40 * 1024 * 1024, MAX_VERSION_FILE_SIZE);
            expect(result.valid).toBe(false);
        });

        it('should validate thumbnails under 1 MB', () => {
            const result = validateFileSize(512 * 1024, MAX_THUMBNAIL_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should validate thumbnails exactly at 1 MB', () => {
            const result = validateFileSize(1 * 1024 * 1024, MAX_THUMBNAIL_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should reject thumbnails over 1 MB', () => {
            const result = validateFileSize(2 * 1024 * 1024, MAX_THUMBNAIL_SIZE);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('2.0 MB');
            expect(result.error).toContain('1.0 MB');
        });
    });

    describe('Re-exported Utilities', () => {
        it('should re-export formatFileSize', () => {
            expect(typeof formatFileSize).toBe('function');
            expect(formatFileSize(1024)).toBe('1.0 KB');
        });

        it('should re-export validateFileSize', () => {
            expect(typeof validateFileSize).toBe('function');
            const result = validateFileSize(1024, 2048);
            expect(result.valid).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle files just under the mod limit', () => {
            const result = validateFileSize(MAX_MOD_FILE_SIZE - 1, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should handle files just over the mod limit', () => {
            const result = validateFileSize(MAX_MOD_FILE_SIZE + 1, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(false);
        });

        it('should handle zero byte files', () => {
            const result = validateFileSize(0, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should handle very large files exceeding mod limit', () => {
            const result = validateFileSize(100 * 1024 * 1024, MAX_MOD_FILE_SIZE);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('100.0 MB');
        });
    });
});

