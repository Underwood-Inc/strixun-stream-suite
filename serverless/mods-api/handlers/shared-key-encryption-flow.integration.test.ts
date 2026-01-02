/**
 * Integration Tests for Shared Key Encryption/Decryption Flow
 * 
 * Tests the complete encryption/decryption flow for mod uploads/downloads:
 * - Client encrypts with shared key → Server decrypts with shared key
 * - Any authenticated user can decrypt files encrypted with shared key
 * 
 * Uses real encryption/decryption, mocks network
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptBinaryWithSharedKey, decryptBinaryWithSharedKey } from '@strixun/api-framework';

// Mock external dependencies
vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
}));

describe('Shared Key Encryption/Decryption Flow Integration', () => {
    const mockSharedKey = 'strixun_mods_encryption_key_test_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Mod Upload Flow (Client → Server)', () => {
        it('should encrypt file on client and decrypt on server with shared key', async () => {
            // Simulate client-side encryption
            const originalFileData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            
            // Client encrypts with shared key
            const encryptedFile = await encryptBinaryWithSharedKey(originalFileData, mockSharedKey);
            
            expect(encryptedFile).toBeDefined();
            expect(encryptedFile).not.toEqual(originalFileData);
            expect(encryptedFile instanceof Uint8Array).toBe(true);
            expect(encryptedFile[0]).toBe(5); // Version 5 format

            // Server decrypts with same shared key (simulating upload handler)
            const decryptedFile = await decryptBinaryWithSharedKey(encryptedFile, mockSharedKey);

            // Verify decrypted data matches original
            expect(decryptedFile).toEqual(originalFileData);
            expect(decryptedFile.length).toBe(originalFileData.length);
        });

        it('should handle large file encryption/decryption', async () => {
            // Simulate a 500KB mod file
            const largeFile = new Uint8Array(500 * 1024);
            for (let i = 0; i < largeFile.length; i++) {
                largeFile[i] = i % 256;
            }

            // Client encrypts
            const encrypted = await encryptBinaryWithSharedKey(largeFile, mockSharedKey);
            
            // Server decrypts
            const decrypted = await decryptBinaryWithSharedKey(encrypted, mockSharedKey);

            // Verify integrity
            expect(decrypted.length).toBe(largeFile.length);
            expect(decrypted).toEqual(largeFile);
        });

        it('should calculate correct hash after decryption', async () => {
            // Simulate server calculating SHA-256 hash after decryption
            const originalFile = new Uint8Array([1, 2, 3, 4, 5]);
            
            // Client encrypts
            const encrypted = await encryptBinaryWithSharedKey(originalFile, mockSharedKey);
            
            // Server decrypts
            const decrypted = await decryptBinaryWithSharedKey(encrypted, mockSharedKey);
            
            // Calculate hash on decrypted data (as server does)
            const hashBuffer = await crypto.subtle.digest('SHA-256', decrypted);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Calculate hash on original (for comparison)
            const originalHashBuffer = await crypto.subtle.digest('SHA-256', originalFile);
            const originalHashArray = Array.from(new Uint8Array(originalHashBuffer));
            const originalHashHex = originalHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Hashes should match
            expect(hashHex).toBe(originalHashHex);
        });
    });

    describe('Mod Download Flow (Server → Client)', () => {
        it('should allow any authenticated user to decrypt with shared key', async () => {
            // Simulate: User A uploads (encrypts), User B downloads (decrypts)
            const originalFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            
            // User A uploads - file encrypted with shared key
            const encryptedFile = await encryptBinaryWithSharedKey(originalFile, mockSharedKey);
            
            // User B downloads - can decrypt with same shared key (any authenticated user)
            const decryptedFile = await decryptBinaryWithSharedKey(encryptedFile, mockSharedKey);
            
            expect(decryptedFile).toEqual(originalFile);
        });

        it('should fail if wrong shared key is used', async () => {
            const originalFile = new Uint8Array([1, 2, 3, 4, 5]);
            const encryptedFile = await encryptBinaryWithSharedKey(originalFile, mockSharedKey);
            
            // Try to decrypt with wrong key
            const wrongKey = 'wrong_shared_key_that_is_long_enough_but_does_not_match_the_original_key_used_for_encryption';
            
            await expect(decryptBinaryWithSharedKey(encryptedFile, wrongKey)).rejects.toThrow('shared key does not match');
        });

        it('should handle multiple users downloading same file', async () => {
            // Simulate: One file, multiple users downloading
            const originalFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            const encryptedFile = await encryptBinaryWithSharedKey(originalFile, mockSharedKey);
            
            // User 1 downloads
            const decrypted1 = await decryptBinaryWithSharedKey(encryptedFile, mockSharedKey);
            expect(decrypted1).toEqual(originalFile);
            
            // User 2 downloads (same file, same key)
            const decrypted2 = await decryptBinaryWithSharedKey(encryptedFile, mockSharedKey);
            expect(decrypted2).toEqual(originalFile);
            
            // User 3 downloads (same file, same key)
            const decrypted3 = await decryptBinaryWithSharedKey(encryptedFile, mockSharedKey);
            expect(decrypted3).toEqual(originalFile);
            
            // All should get same result
            expect(decrypted1).toEqual(decrypted2);
            expect(decrypted2).toEqual(decrypted3);
        });
    });

    describe('Compression Integration', () => {
        it('should compress and decompress during encryption/decryption', async () => {
            // Create highly compressible data
            const compressibleData = new Uint8Array(10000);
            for (let i = 0; i < compressibleData.length; i++) {
                compressibleData[i] = i % 10; // Repeating pattern
            }

            // Encrypt (should compress)
            const encrypted = await encryptBinaryWithSharedKey(compressibleData, mockSharedKey);
            
            // Check compression was used
            const compressionFlag = encrypted[1];
            const wasCompressed = compressionFlag === 1;
            
            if (wasCompressed) {
                // Compressed size should be smaller
                const encryptedDataSize = encrypted.length - (5 + 16 + 12 + 32); // Total - header
                expect(encryptedDataSize).toBeLessThan(compressibleData.length);
            }
            
            // Decrypt (should decompress)
            const decrypted = await decryptBinaryWithSharedKey(encrypted, mockSharedKey);
            
            // Should match original
            expect(decrypted).toEqual(compressibleData);
        });

        it('should handle non-compressible data correctly', async () => {
            // Create random data (not compressible)
            const randomData = new Uint8Array(1000);
            crypto.getRandomValues(randomData);

            // Encrypt
            const encrypted = await encryptBinaryWithSharedKey(randomData, mockSharedKey);
            
            // Decrypt
            const decrypted = await decryptBinaryWithSharedKey(encrypted, mockSharedKey);
            
            // Should match original
            expect(decrypted).toEqual(randomData);
        });
    });

    describe('End-to-End Upload/Download Flow', () => {
        it('should complete full flow: Encrypt Upload → Store → Download Decrypt', async () => {
            // Step 1: Client encrypts file for upload
            const originalFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            const encryptedForUpload = await encryptBinaryWithSharedKey(originalFile, mockSharedKey);
            
            // Step 2: Server receives encrypted file (simulating upload handler)
            // Server temporarily decrypts to calculate hash
            const decryptedForHash = await decryptBinaryWithSharedKey(encryptedForUpload, mockSharedKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', decryptedForHash);
            const fileHash = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            // Step 3: Server stores encrypted file (as-is, no re-encryption)
            const storedEncryptedFile = encryptedForUpload; // Stored as-is
            
            // Step 4: User requests download (any authenticated user)
            const downloadedEncrypted = storedEncryptedFile; // Retrieved from storage
            
            // Step 5: Server decrypts with shared key
            const downloadedDecrypted = await decryptBinaryWithSharedKey(downloadedEncrypted, mockSharedKey);
            
            // Step 6: Verify downloaded file matches original
            expect(downloadedDecrypted).toEqual(originalFile);
            
            // Step 7: Verify hash matches
            const downloadedHashBuffer = await crypto.subtle.digest('SHA-256', downloadedDecrypted);
            const downloadedHash = Array.from(new Uint8Array(downloadedHashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            expect(downloadedHash).toBe(fileHash);
        });

        it('should handle version upload flow correctly', async () => {
            // Simulate version upload: same process as mod upload
            const versionFile = new Uint8Array([10, 20, 30, 40, 50]);
            
            // Client encrypts version file
            const encryptedVersion = await encryptBinaryWithSharedKey(versionFile, mockSharedKey);
            
            // Server decrypts to calculate hash
            const decryptedVersion = await decryptBinaryWithSharedKey(encryptedVersion, mockSharedKey);
            
            // Verify integrity
            expect(decryptedVersion).toEqual(versionFile);
        });
    });

    describe('Error Handling', () => {
        it('should fail gracefully when shared key is missing on server', async () => {
            const encrypted = await encryptBinaryWithSharedKey(
                new Uint8Array([1, 2, 3]),
                mockSharedKey
            );
            
            // Simulate missing key
            const emptyKey = '';
            await expect(decryptBinaryWithSharedKey(encrypted, emptyKey)).rejects.toThrow('minimum 32 characters');
        });

        it('should fail gracefully when shared key is wrong', async () => {
            const encrypted = await encryptBinaryWithSharedKey(
                new Uint8Array([1, 2, 3]),
                mockSharedKey
            );
            
            // Wrong key (but valid length)
            const wrongKey = 'wrong_shared_key_that_is_long_enough_but_does_not_match_the_original_key_used';
            await expect(decryptBinaryWithSharedKey(encrypted, wrongKey)).rejects.toThrow('shared key does not match');
        });

        it('should handle corrupted encrypted data gracefully', async () => {
            const encrypted = await encryptBinaryWithSharedKey(
                new Uint8Array([1, 2, 3]),
                mockSharedKey
            );
            
            // Corrupt the encrypted data
            const corrupted = new Uint8Array(encrypted);
            corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] + 1) % 256;
            
            await expect(decryptBinaryWithSharedKey(corrupted, mockSharedKey)).rejects.toThrow();
        });
    });

    describe('Key Trimming', () => {
        it('should handle keys with leading/trailing whitespace', async () => {
            const originalFile = new Uint8Array([1, 2, 3, 4, 5]);
            
            // Encrypt with key that has whitespace
            const keyWithWhitespace = `  ${mockSharedKey}  `;
            const encrypted = await encryptBinaryWithSharedKey(originalFile, keyWithWhitespace);
            
            // Decrypt with trimmed key (server behavior)
            const trimmedKey = mockSharedKey;
            const decrypted = await decryptBinaryWithSharedKey(encrypted, trimmedKey);
            
            // Should work (key is trimmed during decryption)
            expect(decrypted).toEqual(originalFile);
        });
    });

    describe('Format Compatibility', () => {
        it('should produce same format as JWT encryption (for compatibility)', async () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]);
            const encrypted = await encryptBinaryWithSharedKey(data, mockSharedKey);
            
            // Should use Version 5 format (same as JWT encryption)
            expect(encrypted[0]).toBe(5); // Version
            expect(encrypted[1]).toBeLessThanOrEqual(1); // Compression flag
            expect(encrypted[2]).toBe(16); // Salt length
            expect(encrypted[3]).toBe(12); // IV length
            expect(encrypted[4]).toBe(32); // Hash length
        });
    });
});
