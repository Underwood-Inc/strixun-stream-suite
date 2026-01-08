/**
 * Integration Tests for File Verification Handler
 * 
 * Tests verify that file integrity verification works correctly:
 * - Hash calculation matches stored hash
 * - Tampered files are detected
 * - Verification endpoint returns correct status
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleVerifyVersion } from './verify.js';
import { calculateStrixunHash, verifyStrixunHash } from '../../utils/hash.js';

// Mock dependencies
vi.mock('../../utils/hash.js', () => ({
    calculateStrixunHash: vi.fn(),
    verifyStrixunHash: vi.fn(),
    formatStrixunHash: vi.fn((hash) => `strixun:sha256:${hash}`),
    parseStrixunHash: vi.fn(),
}));

describe('File Verification Handler', () => {
    const mockEnv = {
        MODS_KV: {} as any,
        MODS_R2: {} as any,
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
        sha256: 'a'.repeat(64), // Mock hash
        r2Key: 'files/test-mod-123/version-123',
    };

    const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
        customMetadata: {
            encrypted: 'false', // Not encrypted for tests
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup default mocks
        mockEnv.MODS_KV.get = vi.fn();
        mockEnv.MODS_KV.list = vi.fn().mockResolvedValue({ keys: [], listComplete: true, cursor: undefined });
        mockEnv.MODS_R2.get = vi.fn().mockResolvedValue(mockFile);
        
        // Default: mod found
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

    describe('Successful Verification', () => {
        it('should verify file with matching hash', async () => {
            const storedHash = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(storedHash);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.verified).toBe(true);
            expect(data.actualHash).toBe(`strixun:sha256:${storedHash}`);
        });

        it('should verify file for authenticated user', async () => {
            const storedHash = 'a'.repeat(64);
            vi.mocked(calculateStrixunHash).mockResolvedValue(storedHash);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const auth = { customerId: 'user-123',
                customerId: 'cust-123',
            };

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                auth
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.verified).toBe(true);
        });
    });

    describe('Failed Verification', () => {
        it('should detect tampered file (hash mismatch)', async () => {
            const storedHash = 'a'.repeat(64);
            const tamperedHash = 'b'.repeat(64);
            
            vi.mocked(calculateStrixunHash).mockResolvedValue(tamperedHash);
            vi.mocked(verifyStrixunHash).mockResolvedValue(false);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.verified).toBe(false);
            expect(data.actualHash).toBe(`strixun:sha256:${tamperedHash}`);
            expect(data.expectedHash).toBeDefined();
        });

        it('should handle case-insensitive hash comparison', async () => {
            const storedHash = 'A'.repeat(64); // Uppercase
            const currentHash = 'a'.repeat(64); // Lowercase
            
            vi.mocked(calculateStrixunHash).mockResolvedValue(currentHash);
            vi.mocked(verifyStrixunHash).mockResolvedValue(true);
            
            // Update version with uppercase hash
            const versionWithUppercase = { ...mockVersion, sha256: storedHash };
            vi.mocked(mockEnv.MODS_KV.get).mockImplementation((key: string, options?: any) => {
                if (options?.type === 'json') {
                    if (key === 'mod_test-mod-123') {
                        return Promise.resolve(mockMod);
                    }
                    if (key === 'version_version-123') {
                        return Promise.resolve(versionWithUppercase);
                    }
                    return Promise.resolve(null);
                }
                if (key === 'version_version-123') {
                    return Promise.resolve(JSON.stringify(versionWithUppercase));
                }
                return Promise.resolve(null);
            });
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.verified).toBe(true); // Should match despite case difference
        });
    });

    describe('Error Handling', () => {
        it('should return 404 if mod not found', async () => {
            vi.mocked(mockEnv.MODS_KV.get).mockResolvedValue(null);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(404);
        });

        it('should return 404 if version not found', async () => {
            vi.mocked(mockEnv.MODS_KV.get).mockImplementation((key: string, options?: any) => {
                if (options?.type === 'json') {
                    if (key === 'mod_test-mod-123') {
                        return Promise.resolve(mockMod);
                    }
                    return Promise.resolve(null); // Version not found
                }
                if (key === 'mod_test-mod-123') {
                    return Promise.resolve(JSON.stringify(mockMod));
                }
                return Promise.resolve(null);
            });
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(404);
        });

        it('should return 404 if file not found in R2', async () => {
            vi.mocked(mockEnv.MODS_R2.get).mockResolvedValue(null);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/verify', {
                method: 'GET',
            });

            const response = await handleVerifyVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                null
            );

            expect(response.status).toBe(404);
        });
    });
});

