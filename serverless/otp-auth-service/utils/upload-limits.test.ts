/**
 * Unit Tests for OTP Auth Service Upload Limits
 * 
 * Tests verify that otp-auth-service upload limits work correctly:
 * - Profile picture limit (5 MB from default)
 * - Integration with shared framework
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
    MAX_PROFILE_PICTURE_SIZE,
    formatFileSize,
    validateFileSize,
} from './upload-limits.js';
import {
    DEFAULT_UPLOAD_LIMITS,
} from '@strixun/api-framework';

describe('OTP Auth Service Upload Limits', () => {
    describe('MAX_PROFILE_PICTURE_SIZE', () => {
        it('should be 5 MB (5 * 1024 * 1024 bytes)', () => {
            expect(MAX_PROFILE_PICTURE_SIZE).toBe(5 * 1024 * 1024);
            expect(MAX_PROFILE_PICTURE_SIZE).toBe(5242880);
        });

        it('should use the default from shared framework', () => {
            expect(MAX_PROFILE_PICTURE_SIZE).toBe(DEFAULT_UPLOAD_LIMITS.maxProfilePictureSize);
        });

        it('should be a number', () => {
            expect(typeof MAX_PROFILE_PICTURE_SIZE).toBe('number');
        });
    });

    describe('Validation with Profile Picture Limits', () => {
        it('should validate profile pictures under 5 MB', () => {
            const result = validateFileSize(3 * 1024 * 1024, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should validate profile pictures exactly at 5 MB', () => {
            const result = validateFileSize(5 * 1024 * 1024, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should reject profile pictures over 5 MB', () => {
            const result = validateFileSize(6 * 1024 * 1024, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('6.0 MB');
            expect(result.error).toContain('5.0 MB');
        });

        it('should handle small profile pictures', () => {
            const result = validateFileSize(100 * 1024, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should handle zero byte files', () => {
            const result = validateFileSize(0, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(true);
        });
    });

    describe('Re-exported Utilities', () => {
        it('should re-export formatFileSize', () => {
            expect(typeof formatFileSize).toBe('function');
            expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
        });

        it('should re-export validateFileSize', () => {
            expect(typeof validateFileSize).toBe('function');
            const result = validateFileSize(1024, 2048);
            expect(result.valid).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle files just under the limit', () => {
            const result = validateFileSize(MAX_PROFILE_PICTURE_SIZE - 1, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(true);
        });

        it('should handle files just over the limit', () => {
            const result = validateFileSize(MAX_PROFILE_PICTURE_SIZE + 1, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(false);
        });

        it('should handle very large files exceeding limit', () => {
            const result = validateFileSize(100 * 1024 * 1024, MAX_PROFILE_PICTURE_SIZE);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('100.0 MB');
        });
    });
});

