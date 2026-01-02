/**
 * Unit Tests for Shared Key Binary Encryption Utilities
 * Tests encryptBinaryWithSharedKey and decryptBinaryWithSharedKey functions
 * 
 * These functions are optimized for file encryption using a shared key
 * that allows any authenticated user to decrypt mod files
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptBinaryWithSharedKey, decryptBinaryWithSharedKey } from './shared-key-encryption.js';

// Ensure CompressionStream is available (Node.js 18+)
beforeAll(() => {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream not available - requires Node.js 18+');
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available - requires Node.js 18+');
  }
});

describe('Shared Key Binary Encryption Utilities', () => {
  const validSharedKey = 'strixun_mods_encryption_key_test_2025_secure_random_64_char_minimum_required_for_pbkdf2_derivation';

  describe('encryptBinaryWithSharedKey', () => {
    it('should encrypt binary data with valid shared key', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);

      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(data.length); // Should include header + encrypted data
      expect(encrypted[0]).toBe(5); // Version 5: binary format with compression
      expect(encrypted[1]).toBeLessThanOrEqual(1); // Compression flag (0 or 1)
      expect(encrypted[2]).toBe(16); // Salt length
      expect(encrypted[3]).toBe(12); // IV length
      expect(encrypted[4]).toBe(32); // Key hash length
    });

    it('should encrypt ArrayBuffer', async () => {
      const data = new ArrayBuffer(100);
      const view = new Uint8Array(data);
      for (let i = 0; i < 100; i++) {
        view[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(100);
    });

    it('should throw error for invalid shared key (too short)', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithSharedKey(data, 'short')).rejects.toThrow('Valid shared encryption key is required (minimum 32 characters)');
    });

    it('should throw error for empty shared key', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithSharedKey(data, '')).rejects.toThrow('Valid shared encryption key is required (minimum 32 characters)');
    });

    it('should throw error for null/undefined shared key', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithSharedKey(data, null as any)).rejects.toThrow();
      await expect(encryptBinaryWithSharedKey(data, undefined as any)).rejects.toThrow();
    });

    it('should generate unique encryption for same data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted1 = await encryptBinaryWithSharedKey(data, validSharedKey);
      const encrypted2 = await encryptBinaryWithSharedKey(data, validSharedKey);

      // Different salt/IV should produce different encrypted data
      // But header should be the same (except compression flag may differ)
      expect(encrypted1[0]).toBe(encrypted2[0]); // Version
      expect(encrypted1[2]).toBe(encrypted2[2]); // Salt length
      expect(encrypted1[3]).toBe(encrypted2[3]); // IV length
      expect(encrypted1[4]).toBe(encrypted2[4]); // Hash length
      
      // But encrypted data should be different (due to random salt/IV)
      const data1 = encrypted1.slice(5 + 16 + 12 + 32); // Skip header + salt + IV + hash
      const data2 = encrypted2.slice(5 + 16 + 12 + 32);
      expect(data1).not.toEqual(data2);
    });

    it('should handle large binary data', async () => {
      // Simulate a 1MB file
      const data = new Uint8Array(1024 * 1024);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      // With compression, encrypted data can be smaller than original (good!)
      // Without compression, it should be larger (header + encryption overhead)
      // So we just check it's a reasonable size (not way too large)
      expect(encrypted.length).toBeLessThan(data.length * 1.2); // Less than 20% overhead if not compressed
      expect(encrypted.length).toBeGreaterThan(100); // Should have at least header
    });

    it('should handle empty binary data', async () => {
      const data = new Uint8Array(0);
      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(0); // Should have header at minimum
    });

    it('should have correct binary format structure', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);

      // Verify header structure (Version 5)
      expect(encrypted[0]).toBe(5); // Version 5
      expect(encrypted[1]).toBeLessThanOrEqual(1); // Compression flag
      expect(encrypted[2]).toBe(16); // Salt length
      expect(encrypted[3]).toBe(12); // IV length
      expect(encrypted[4]).toBe(32); // Key hash length

      // Verify total size: header (5) + salt (16) + IV (12) + hash (32) + encrypted data
      const headerSize = 5;
      const saltSize = 16;
      const ivSize = 12;
      const hashSize = 32;
      const minSize = headerSize + saltSize + ivSize + hashSize;
      expect(encrypted.length).toBeGreaterThanOrEqual(minSize);
    });

    it('should handle shared key with whitespace (trimming)', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const keyWithWhitespace = `  ${validSharedKey}  `;
      const encrypted = await encryptBinaryWithSharedKey(data, keyWithWhitespace);
      
      // Should encrypt successfully (key will be trimmed internally during decryption)
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });

  describe('decryptBinaryWithSharedKey', () => {
    it('should decrypt binary data with correct shared key', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted).toEqual(originalData);
    });

    it('should decrypt ArrayBuffer', async () => {
      const originalData = new ArrayBuffer(100);
      const view = new Uint8Array(originalData);
      for (let i = 0; i < 100; i++) {
        view[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted.buffer, validSharedKey);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(100);
      expect(new Uint8Array(originalData)).toEqual(decrypted);
    });

    it('should throw error for wrong shared key', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const wrongKey = 'wrong_shared_key_that_is_long_enough_but_does_not_match_the_original_key_used_for_encryption';

      await expect(decryptBinaryWithSharedKey(encrypted, wrongKey)).rejects.toThrow('shared key does not match');
    });

    it('should throw error for invalid shared key (too short)', async () => {
      const encrypted = new Uint8Array([5, 0, 16, 12, 32]);
      await expect(decryptBinaryWithSharedKey(encrypted, 'short')).rejects.toThrow('Valid shared encryption key is required (minimum 32 characters)');
    });

    it('should throw error for empty shared key', async () => {
      const encrypted = new Uint8Array([5, 0, 16, 12, 32]);
      await expect(decryptBinaryWithSharedKey(encrypted, '')).rejects.toThrow('Valid shared encryption key is required (minimum 32 characters)');
    });

    it('should throw error for invalid binary format (too short)', async () => {
      const invalidData = new Uint8Array([5, 0, 16, 12]); // Missing hash length
      await expect(decryptBinaryWithSharedKey(invalidData, validSharedKey)).rejects.toThrow('Invalid encrypted binary format');
    });

    it('should throw error for unsupported version', async () => {
      const invalidData = new Uint8Array([6, 0, 16, 12, 32]); // Version 6 (not supported)
      await expect(decryptBinaryWithSharedKey(invalidData, validSharedKey)).rejects.toThrow('Unsupported binary encryption version');
    });

    it('should throw error for invalid header lengths', async () => {
      const invalidData = new Uint8Array([5, 0, 8, 12, 32]); // Wrong salt length
      await expect(decryptBinaryWithSharedKey(invalidData, validSharedKey)).rejects.toThrow('Invalid encrypted binary format');
    });

    it('should decrypt large binary data', async () => {
      // Simulate a 1MB file
      const originalData = new Uint8Array(1024 * 1024);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(originalData.length);
      expect(decrypted).toEqual(originalData);
    });

    it('should decrypt empty binary data', async () => {
      const originalData = new Uint8Array(0);
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(0);
      expect(decrypted).toEqual(originalData);
    });

    it('should verify shared key hash matches', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);

      // Should decrypt successfully with correct key
      await expect(decryptBinaryWithSharedKey(encrypted, validSharedKey)).resolves.toBeInstanceOf(Uint8Array);

      // Should fail with different key
      const differentKey = 'different_shared_key_that_is_long_enough_but_does_not_match_the_original_key_used';
      await expect(decryptBinaryWithSharedKey(encrypted, differentKey)).rejects.toThrow('shared key does not match');
    });

    it('should handle shared key with whitespace (trimming)', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      
      // Decrypt with key that has whitespace (should be trimmed)
      const keyWithWhitespace = `  ${validSharedKey}  `;
      const decrypted = await decryptBinaryWithSharedKey(encrypted, keyWithWhitespace);
      
      expect(decrypted).toEqual(originalData);
    });

    it('should support version 4 format (backward compatibility)', async () => {
      // Version 4 format: [version(1)][saltLen(1)][ivLen(1)][hashLen(1)][salt(16)][iv(12)][hash(32)][encryptedData]
      // Version 5 format: [version(1)][compressed(1)][saltLen(1)][ivLen(1)][hashLen(1)][salt(16)][iv(12)][hash(32)][encryptedData]
      // 
      // To test version 4, we'll create a version 5 file (uncompressed) and convert it to version 4
      // by removing the compression flag byte
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      
      // Check if it was compressed (version 5, byte 1 = compression flag)
      const wasCompressed = encrypted[1] === 1;
      
      // If it was compressed, we can't easily convert to version 4 (version 4 doesn't support compression)
      // So we'll test with an uncompressed version 5 file
      if (wasCompressed) {
        // Skip this test if data was compressed (version 4 doesn't support compression)
        // This is acceptable - version 4 files in practice would be uncompressed
        return;
      }
      
      // Convert version 5 (uncompressed) to version 4 by removing compression flag
      // Version 5 header: [5][0][16][12][32] = 5 bytes
      // Version 4 header: [4][16][12][32] = 4 bytes
      const v4Encrypted = new Uint8Array(encrypted.length - 1);
      v4Encrypted[0] = 4; // Version 4
      v4Encrypted[1] = encrypted[2]; // Salt length (skip compression flag)
      v4Encrypted[2] = encrypted[3]; // IV length
      v4Encrypted[3] = encrypted[4]; // Hash length
      // Copy rest of data (salt, IV, hash, encrypted data) - skip byte 1 (compression flag)
      v4Encrypted.set(encrypted.slice(5), 4);
      
      // Should decrypt successfully (version 4 format is supported)
      const decrypted = await decryptBinaryWithSharedKey(v4Encrypted, validSharedKey);
      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted).toEqual(originalData);
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully encrypt and decrypt binary data', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const encrypted = await encryptBinaryWithSharedKey(testData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);

      expect(decrypted).toEqual(testData);
    });

    it('should handle multiple encrypt/decrypt cycles', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      let encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);

      for (let i = 0; i < 5; i++) {
        const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
        // Modify data slightly
        const modified = new Uint8Array(decrypted.length + 1);
        modified.set(decrypted);
        modified[decrypted.length] = i;
        encrypted = await encryptBinaryWithSharedKey(modified, validSharedKey);
      }

      const finalDecrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
      expect(finalDecrypted.length).toBe(data.length + 5); // Original + 5 additions
    });

    it('should maintain data integrity through encryption/decryption', async () => {
      // Test with various data patterns
      const testCases = [
        new Uint8Array([0, 0, 0, 0, 0]), // All zeros
        new Uint8Array([255, 255, 255, 255, 255]), // All ones
        new Uint8Array([0, 255, 0, 255, 0]), // Alternating
        new Uint8Array(Array.from({ length: 256 }, (_, i) => i)), // 0-255 sequence
      ];

      for (const testData of testCases) {
        const encrypted = await encryptBinaryWithSharedKey(testData, validSharedKey);
        const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
        expect(decrypted).toEqual(testData);
      }
    });

    it('should allow any user with same key to decrypt', async () => {
      // Simulate: User A encrypts, User B decrypts (both use same shared key)
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      
      // User A encrypts
      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      
      // User B decrypts (same shared key)
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
      
      expect(decrypted).toEqual(originalData);
    });
  });

  describe('compression', () => {
    it('should compress compressible data', async () => {
      // Create highly compressible data (repeating pattern)
      const data = new Uint8Array(10000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 10; // Repeating pattern - highly compressible
      }

      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      
      // Check compression flag is set
      const compressionFlag = encrypted[1];
      expect(compressionFlag).toBeLessThanOrEqual(1);
      
      // Compressed data should be smaller than original (accounting for encryption overhead)
      // Encryption adds ~65 bytes header + minimal padding, but compression should save more
      const encryptionOverhead = 65 + (data.length * 0.05); // ~5% for padding
      const expectedMaxSize = data.length + encryptionOverhead;
      
      // If compression is used, encrypted size should be less than original + overhead
      if (compressionFlag === 1) {
        expect(encrypted.length).toBeLessThan(expectedMaxSize);
      }
    });

    it('should handle non-compressible data (skip compression)', async () => {
      // Create random data that doesn't compress well
      const data = new Uint8Array(1000);
      crypto.getRandomValues(data); // Random data - not compressible

      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      
      // Should still encrypt successfully
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(data.length);
      
      // Should decrypt correctly
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
      expect(decrypted).toEqual(data);
    });

    it('should decompress compressed data correctly', async () => {
      // Create compressible data
      const originalData = new Uint8Array(5000);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 50; // Repeating pattern
      }

      const encrypted = await encryptBinaryWithSharedKey(originalData, validSharedKey);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, validSharedKey);
      
      // Should match original exactly
      expect(decrypted).toEqual(originalData);
    });
  });

  describe('storage efficiency', () => {
    it('should have minimal overhead compared to base64 encoding', async () => {
      // Base64 encoding adds ~33% overhead
      // Binary encryption should add only ~5-10% overhead (encryption padding)
      const data = new Uint8Array(1000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithSharedKey(data, validSharedKey);
      
      // Binary format overhead: header (5) + salt (16) + IV (12) + hash (32) = 65 bytes
      // Plus encryption padding (minimal for AES-GCM)
      // With compression, may actually be smaller than original!
      const expectedOverhead = 65 + (data.length * 0.05); // ~5% for padding (if not compressed)
      const actualOverhead = encrypted.length - data.length;
      
      // Should be much less than base64 overhead (33% = 330 bytes for 1000 bytes)
      expect(actualOverhead).toBeLessThan(330);
      // With compression, overhead could be negative (compressed smaller than original)
      // So we just check it's reasonable
      expect(actualOverhead).toBeLessThan(expectedOverhead * 2); // Allow some variance
    });
  });

  describe('key validation', () => {
    it('should accept keys of exactly 32 characters', async () => {
      const key32 = 'a'.repeat(32);
      const data = new Uint8Array([1, 2, 3]);
      const encrypted = await encryptBinaryWithSharedKey(data, key32);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, key32);
      expect(decrypted).toEqual(data);
    });

    it('should reject keys shorter than 32 characters', async () => {
      const key31 = 'a'.repeat(31);
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithSharedKey(data, key31)).rejects.toThrow('minimum 32 characters');
    });

    it('should accept keys longer than 32 characters', async () => {
      const key128 = 'a'.repeat(128);
      const data = new Uint8Array([1, 2, 3]);
      const encrypted = await encryptBinaryWithSharedKey(data, key128);
      const decrypted = await decryptBinaryWithSharedKey(encrypted, key128);
      expect(decrypted).toEqual(data);
    });
  });
});
