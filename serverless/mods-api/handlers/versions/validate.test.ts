/**
 * Integration Tests for File Validation Handler
 * 
 * Tests verify that file validation works correctly:
 * - Client can validate their file against uploaded version
 * - Keyphrase is never exposed
 * - Validation works for matching and non-matching files
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleValidateVersion } from './validate.js';
import { calculateStrixunHash, verifyStrixunHash } from '../../utils/hash.js';

// Mock dependencies
vi.mock('../../utils/hash.js', () => ({
    calculateStrixunHash: vi.fn(),
    verifyStrixunHash: vi.fn(),
    formatStrixunHash: vi.fn((hash) => `strixun:sha256:${hash}`),
    parseStrixunHash: vi.fn(),
}));

describe('File Validation Handler', () => {
    const mockEnv = {
        MODS_KV: {} as any,
        MODS_R2: {} as any,
        FILE_INTEGRITY_KEYPHRASE: 'test-keyphrase',
        ALLOWED_ORIGINS: 'https://example.com',
    };

    const mockMod = {
        modId: 'test-mod-123',
        slug: 'test-mod',
        authorId: 'user-123',
        customerId: 'cust-123',
        status: 'published',
        visibility: 'public',
    };

    const mockVersion = {
        versionId: 'version-123',
        modId: 'test-mod-123',
        sha256: 'a'.repeat(64), // Mock signature
        r2Key: 'files/test-mod-123/version-123',
        fileName: 'test-mod.lua',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockEnv.MODS_KV.get = vi.fn();
        mockEnv.MODS_KV.list = vi.fn().mockResolvedValue({ keys: [], listComplete: true, cursor: undefined });
        
        vi.mocked(mockEnv.MODS_KV.get).mockImplementation((key: string, options?: any) => {
            if (options?.type === 'json') {
                if (key === 'mod_test-mod-123') {
                    return Promise.resolve(mockMod);
                }
                if (key === 'version_version-123') {
                    return Promise.resolve(mockVersion);
                }
                return Promise.resolve(null);
            }
            if (key === 'mod_test-mod-123') {
                return Promise.resolve(JSON.stringify(mockMod));
            }
            if (key === 'version_version-123') {
                return Promise.resolve(JSON.stringify(mockVersion));
            }
            return Promise.resolve(null);
        });
    });

    describe('Successful Validation', () => {
        it('should validate matching file', async () => {
            const matchingSignature = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(matchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const formData = new FormData();
            const file = new File(['test file content'], 'test.lua', { type: 'text/plain' });
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.validated).toBe(true);
            expect(data.signaturesMatch).toBe(true);
            expect(data.uploadedFileSignature).toBeDefined();
            expect(data.expectedSignature).toBeDefined();
        });

        it('should validate file for authenticated user', async () => {
            const matchingSignature = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(matchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const formData = new FormData();
            const file = new File(['test content'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const auth = { customerId: 'user-123',
                customerId: 'cust-123',
            };

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                auth
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.validated).toBe(true);
        });
    });

    describe('Failed Validation', () => {
        it('should reject non-matching file', async () => {
            const nonMatchingSignature = 'b'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(nonMatchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(false);
            
            const formData = new FormData();
            const file = new File(['different content'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.validated).toBe(false);
            expect(data.signaturesMatch).toBe(false);
        });
    });

    describe('Security - Keyphrase Protection', () => {
        it('should not expose keyphrase in response', async () => {
            const matchingSignature = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(matchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const formData = new FormData();
            const file = new File(['test'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            const data = await response.json();
            const responseText = JSON.stringify(data);
            
            // Keyphrase should never appear in response
            expect(responseText).not.toContain('FILE_INTEGRITY_KEYPHRASE');
            expect(responseText).not.toContain('test-keyphrase');
            expect(responseText).not.toContain('keyphrase');
            
            // Only signatures should appear
            expect(data.uploadedFileSignature).toBeDefined();
            expect(data.expectedSignature).toBeDefined();
        });

        it('should use keyphrase server-side only', async () => {
            const matchingSignature = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(matchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const formData = new FormData();
            const file = new File(['test'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            // Verify calculateStrixunHash was called with env (keyphrase server-side)
            expect(calculateStrixunHash).toHaveBeenCalledWith(
                expect.any(ArrayBuffer),
                mockEnv // env contains keyphrase, but it's server-side only
            );
        });
    });

    describe('Error Handling', () => {
        it('should return 404 if mod not found', async () => {
            vi.mocked(mockEnv.MODS_KV.get).mockResolvedValue(null);
            
            const formData = new FormData();
            const file = new File(['test'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(404);
        });

        it('should return 400 if file is missing', async () => {
            const formData = new FormData();
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(400);
        });

        it('should return 400 if version has no signature', async () => {
            const versionWithoutHash = { ...mockVersion, sha256: undefined };
            vi.mocked(mockEnv.MODS_KV.get).mockImplementation((key: string, options?: any) => {
                if (options?.type === 'json') {
                    if (key === 'mod_test-mod-123') {
                        return Promise.resolve(mockMod);
                    }
                    if (key === 'version_version-123') {
                        return Promise.resolve(versionWithoutHash);
                    }
                    return Promise.resolve(null);
                }
                if (key === 'version_version-123') {
                    return Promise.resolve(JSON.stringify(versionWithoutHash));
                }
                return Promise.resolve(null);
            });
            
            const formData = new FormData();
            const file = new File(['test'], 'test.lua');
            formData.append('file', file);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                body: formData,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(400);
        });
    });

    describe('Raw Binary Data Support', () => {
        it('should handle raw binary data (not just form data)', async () => {
            const matchingSignature = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(matchingSignature);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const fileContent = new Uint8Array([1, 2, 3, 4, 5]);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
                body: fileContent,
            });

            const response = await handleValidateVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.validated).toBe(true);
        });
    });
});

