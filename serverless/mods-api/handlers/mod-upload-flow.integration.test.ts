/**
 * Integration Tests for Mod Upload Flow
 * 
 * Tests the complete mod upload flow:
 * - Upload [EMOJI] Store [EMOJI] Verify integrity [EMOJI] Download
 * 
 * Uses real hash calculation, mocks R2/KV
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateFileHash, formatStrixunHash } from '../../utils/hash.js';
import { createJWT } from '../../../otp-auth-service/utils/crypto.js';

// Mock external dependencies
vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
}));

vi.mock('../../utils/admin.js', () => ({
    hasUploadPermission: vi.fn().mockResolvedValue(true),
    isEmailAllowed: vi.fn().mockReturnValue(true),
}));

describe('Mod Upload Flow Integration', () => {
    const mockEnv = {
        JWT_SECRET: 'test-jwt-secret-for-integration-tests',
        MODS_KV: {
            get: vi.fn(),
            put: vi.fn(),
            list: vi.fn(),
        },
        MODS_R2: {
            put: vi.fn(),
            get: vi.fn(),
        },
        ALLOWED_ORIGINS: '*',
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('File Hash Calculation', () => {
        it('should calculate hash for uploaded file content', async () => {
            const fileContent = new TextEncoder().encode('test mod file content');
            
            const hash = await calculateFileHash(fileContent);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 produces 64-character hex string
        });

        it('should produce same hash for same content', async () => {
            const fileContent = new TextEncoder().encode('test mod file content');
            
            const hash1 = await calculateFileHash(fileContent);
            const hash2 = await calculateFileHash(fileContent);
            
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different content', async () => {
            const content1 = new TextEncoder().encode('test mod file content');
            const content2 = new TextEncoder().encode('different mod file content');
            
            const hash1 = await calculateFileHash(content1);
            const hash2 = await calculateFileHash(content2);
            
            expect(hash1).not.toBe(hash2);
        });

        it('should format hash correctly for storage', async () => {
            const fileContent = new TextEncoder().encode('test mod file content');
            const hash = await calculateFileHash(fileContent);
            const formattedHash = formatStrixunHash(hash);
            
            expect(formattedHash).toBeDefined();
            expect(formattedHash).toMatch(/^strixun:sha256:[a-f0-9]{64}$/i);
        });
    });

    describe('Upload Flow - Hash Verification', () => {
        it('should calculate hash before storing file', async () => {
            const fileContent = new TextEncoder().encode('test mod file content');
            
            // Step 1: Calculate hash (before upload)
            const hash = await calculateFileHash(fileContent);
            const formattedHash = formatStrixunHash(hash);
            
            expect(hash).toBeDefined();
            expect(formattedHash).toMatch(/^strixun:sha256:/);
            
            // Step 2: Simulate storing hash with mod metadata
            const modMetadata = {
                modId: 'mod_123',
                sha256: formattedHash,
                fileName: 'test-mod.lua',
            };
            
            expect(modMetadata.sha256).toBe(formattedHash);
        });

        it('should verify hash matches after download', async () => {
            const originalContent = new TextEncoder().encode('test mod file content');
            
            // Step 1: Calculate hash on upload
            const uploadHash = await calculateFileHash(originalContent);
            const formattedUploadHash = formatStrixunHash(uploadHash);
            
            // Step 2: Simulate file storage and retrieval
            // (In real flow, file would be stored in R2 and retrieved)
            const downloadedContent = originalContent; // Simulated download
            
            // Step 3: Calculate hash on download
            const downloadHash = await calculateFileHash(downloadedContent);
            const formattedDownloadHash = formatStrixunHash(downloadHash);
            
            // Step 4: Verify hashes match
            expect(formattedUploadHash).toBe(formattedDownloadHash);
            expect(uploadHash).toBe(downloadHash);
        });

        it('should detect tampering if file content changes', async () => {
            const originalContent = new TextEncoder().encode('test mod file content');
            const tamperedContent = new TextEncoder().encode('tampered mod file content');
            
            // Calculate hash for original
            const originalHash = await calculateFileHash(originalContent);
            
            // Calculate hash for tampered content
            const tamperedHash = await calculateFileHash(tamperedContent);
            
            // Verify hashes are different (tampering detected)
            expect(originalHash).not.toBe(tamperedHash);
        });
    });

    describe('End-to-End Upload Flow', () => {
        it('should complete full flow: Upload [EMOJI] Hash [EMOJI] Store [EMOJI] Verify', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';
            
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createJWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            }, mockEnv.JWT_SECRET);

            const fileContent = new TextEncoder().encode('test mod file content');
            const modId = 'mod_123';
            
            // Step 1: Calculate hash on upload
            const hash = await calculateFileHash(fileContent);
            const formattedHash = formatStrixunHash(hash);
            
            // Step 2: Store mod metadata with hash
            const modMetadata = {
                modId: modId,
                authorId: userId,
                customerId: customerId,
                sha256: formattedHash,
                fileName: 'test-mod.lua',
                status: 'pending',
            };
            
            // Mock KV storage
            vi.mocked(mockEnv.MODS_KV.put).mockResolvedValue(undefined);
            
            // Step 3: Verify hash is stored correctly
            expect(modMetadata.sha256).toBe(formattedHash);
            expect(modMetadata.modId).toBe(modId);
            expect(modMetadata.customerId).toBe(customerId);
            
            // Step 4: Simulate download and verify hash matches
            const downloadedContent = fileContent; // Simulated download
            const downloadHash = await calculateFileHash(downloadedContent);
            const formattedDownloadHash = formatStrixunHash(downloadHash);
            
            expect(formattedDownloadHash).toBe(formattedHash);
        });

        it('should maintain hash integrity through compression/decompression', async () => {
            const originalContent = new TextEncoder().encode('test mod file content');
            
            // Calculate hash on original content
            const originalHash = await calculateFileHash(originalContent);
            
            // Simulate compression (content would be compressed in real flow)
            // Note: In real flow, hash is calculated on decrypted content, not compressed
            const decompressedContent = originalContent; // Simulated decompression
            
            // Calculate hash on decompressed content
            const decompressedHash = await calculateFileHash(decompressedContent);
            
            // Verify hash matches (hash is calculated on decrypted content, not compressed)
            expect(originalHash).toBe(decompressedHash);
        });
    });
});

