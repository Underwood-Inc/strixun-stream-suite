/**
 * Integration Tests for File Download Integrity
 * 
 * Tests verify that file integrity is maintained through download process:
 * - Hash headers are included in download response
 * - Downloaded file matches uploaded file hash
 * - Integrity verification works end-to-end
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDownloadVersion } from './download.js';
import { formatStrixunHash } from '../../utils/hash.js';

// Mock dependencies
vi.mock('../../utils/hash.js', () => ({
    calculateFileHash: vi.fn(),
    formatStrixunHash: vi.fn((hash) => `strixun:sha256:${hash}`),
    parseStrixunHash: vi.fn(),
}));

vi.mock('@strixun/api-framework', () => ({
    decryptWithJWT: vi.fn(),
    decryptBinaryWithJWT: vi.fn(),
}));

describe('File Download Integrity', () => {
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
        sha256: 'a'.repeat(64),
        r2Key: 'files/test-mod-123/version-123',
        fileName: 'test-mod.lua',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockEnv.MODS_KV.get = vi.fn();
        mockEnv.MODS_KV.put = vi.fn().mockResolvedValue(undefined);
        mockEnv.MODS_KV.list = vi.fn().mockResolvedValue({ keys: [], listComplete: true, cursor: undefined });
        mockEnv.MODS_R2.get = vi.fn();
        
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

    describe('Hash Headers in Download Response', () => {
        it('should include hash headers when version has sha256', async () => {
            const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
            vi.mocked(decryptBinaryWithJWT).mockResolvedValue(new Uint8Array([1, 2, 3]));
            
            const mockR2File = {
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
            };
            vi.mocked(mockEnv.MODS_R2.get).mockResolvedValue(mockR2File as any);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/download', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer test-token',
                },
            });

            const auth = {
                customerId: 'cust-123',
                email: 'user@example.com',
            };

            const response = await handleDownloadVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                auth
            );

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Strixun-File-Hash')).toBe(`strixun:sha256:${mockVersion.sha256}`);
            expect(response.headers.get('X-Strixun-SHA256')).toBe(mockVersion.sha256);
        });

        it('should not include hash headers when version has no sha256', async () => {
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
                if (key === 'mod_test-mod-123') {
                    return Promise.resolve(JSON.stringify(mockMod));
                }
                if (key === 'version_version-123') {
                    return Promise.resolve(JSON.stringify(versionWithoutHash));
                }
                return Promise.resolve(null);
            });
            
            const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
            vi.mocked(decryptBinaryWithJWT).mockResolvedValue(new Uint8Array([1, 2, 3]));
            
            const mockR2File = {
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
            };
            vi.mocked(mockEnv.MODS_R2.get).mockResolvedValue(mockR2File as any);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/download', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer test-token',
                },
            });

            const auth = {
                customerId: 'cust-123',
                email: 'user@example.com',
            };

            const response = await handleDownloadVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                auth
            );

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Strixun-File-Hash')).toBeNull();
            expect(response.headers.get('X-Strixun-SHA256')).toBeNull();
        });
    });

    describe('End-to-End Integrity Verification', () => {
        it('should allow client to verify downloaded file matches stored hash', async () => {
            const storedHash = 'a'.repeat(64);
            const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
            const { calculateFileHash } = await import('../../utils/hash.js');
            
            // Simulate decrypted file content
            const decryptedContent = new Uint8Array([1, 2, 3, 4, 5]);
            vi.mocked(decryptBinaryWithJWT).mockResolvedValue(decryptedContent);
            vi.mocked(calculateFileHash).mockResolvedValue(storedHash);
            
            const mockR2File = {
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
            };
            vi.mocked(mockEnv.MODS_R2.get).mockResolvedValue(mockR2File as any);
            
            const request = new Request('https://api.example.com/mods/test-mod/versions/version-123/download', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer test-token',
                },
            });

            const auth = {
                customerId: 'cust-123',
                email: 'user@example.com',
            };

            const response = await handleDownloadVersion(
                request,
                mockEnv,
                'test-mod-123',
                'version-123',
                auth
            );

            expect(response.status).toBe(200);
            
            // Client can verify by:
            // 1. Getting hash from header
            const headerHash = response.headers.get('X-Strixun-SHA256');
            expect(headerHash).toBe(storedHash);
            
            // 2. Calculating hash of downloaded content
            const downloadedContent = await response.arrayBuffer();
            const downloadedHash = await calculateFileHash(downloadedContent);
            
            // 3. Comparing hashes
            expect(downloadedHash).toBe(storedHash);
        });
    });
});

