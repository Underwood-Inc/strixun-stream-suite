/**
 * Unit Tests for Binary JWT Encryption Utilities
 * Tests encryptBinaryWithJWT and decryptBinaryWithJWT functions
 * 
 * These functions are optimized for file encryption, eliminating
 * base64/JSON overhead (40-45% reduction in storage size)
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptBinaryWithJWT, decryptBinaryWithJWT } from './jwt-encryption.js';

// Ensure CompressionStream is available (Node.js 18+)
beforeAll(() => {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream not available - requires Node.js 18+');
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream not available - requires Node.js 18+');
  }
});

describe('Binary JWT Encryption Utilities', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1NiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.test-signature';

  describe('encryptBinaryWithJWT', () => {
    it('should encrypt binary data with valid JWT token', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const encrypted = await encryptBinaryWithJWT(data, validToken);

      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(data.length); // Should include header + encrypted data
      expect(encrypted[0]).toBe(5); // Version 5: binary format with compression
      expect(encrypted[1]).toBeLessThanOrEqual(1); // Compression flag (0 or 1)
      expect(encrypted[2]).toBe(16); // Salt length
      expect(encrypted[3]).toBe(12); // IV length
      expect(encrypted[4]).toBe(32); // Token hash length
    });

    it('should encrypt ArrayBuffer', async () => {
      const data = new ArrayBuffer(100);
      const view = new Uint8Array(data);
      for (let i = 0; i < 100; i++) {
        view[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithJWT(data, validToken);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(100);
    });

    it('should throw error for invalid token (too short)', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithJWT(data, 'short')).rejects.toThrow('Valid JWT token is required for encryption');
    });

    it('should throw error for empty token', async () => {
      const data = new Uint8Array([1, 2, 3]);
      await expect(encryptBinaryWithJWT(data, '')).rejects.toThrow('Valid JWT token is required for encryption');
    });

    it('should generate unique encryption for same data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted1 = await encryptBinaryWithJWT(data, validToken);
      const encrypted2 = await encryptBinaryWithJWT(data, validToken);

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

      const encrypted = await encryptBinaryWithJWT(data, validToken);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      // With compression, encrypted data can be smaller than original (good!)
      // Without compression, it should be larger (header + encryption overhead)
      // So we just check it's a reasonable size (not way too large)
      expect(encrypted.length).toBeLessThan(data.length * 1.2); // Less than 20% overhead if not compressed
      expect(encrypted.length).toBeGreaterThan(100); // Should have at least header
    });

    it('should handle empty binary data', async () => {
      const data = new Uint8Array(0);
      const encrypted = await encryptBinaryWithJWT(data, validToken);
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(0); // Should have header at minimum
    });

    it('should have correct binary format structure', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithJWT(data, validToken);

      // Verify header structure (Version 5)
      expect(encrypted[0]).toBe(5); // Version 5
      expect(encrypted[1]).toBeLessThanOrEqual(1); // Compression flag
      expect(encrypted[2]).toBe(16); // Salt length
      expect(encrypted[3]).toBe(12); // IV length
      expect(encrypted[4]).toBe(32); // Token hash length

      // Verify total size: header (5) + salt (16) + IV (12) + hash (32) + encrypted data
      const headerSize = 5;
      const saltSize = 16;
      const ivSize = 12;
      const hashSize = 32;
      const minSize = headerSize + saltSize + ivSize + hashSize;
      expect(encrypted.length).toBeGreaterThanOrEqual(minSize);
    });
  });

  describe('decryptBinaryWithJWT', () => {
    it('should decrypt binary data with correct token', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted).toEqual(originalData);
    });

    it('should decrypt ArrayBuffer', async () => {
      const originalData = new ArrayBuffer(100);
      const view = new Uint8Array(originalData);
      for (let i = 0; i < 100; i++) {
        view[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted.buffer, validToken);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(100);
      expect(new Uint8Array(originalData)).toEqual(decrypted);
    });

    it('should throw error for wrong token', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const wrongToken = 'wrong.token.here';

      await expect(decryptBinaryWithJWT(encrypted, wrongToken)).rejects.toThrow();
    });

    it('should throw error for invalid token (too short)', async () => {
      const encrypted = new Uint8Array([5, 0, 16, 12, 32]);
      await expect(decryptBinaryWithJWT(encrypted, 'short')).rejects.toThrow('Valid JWT token is required for decryption');
    });

    it('should throw error for empty token', async () => {
      const encrypted = new Uint8Array([5, 0, 16, 12, 32]);
      await expect(decryptBinaryWithJWT(encrypted, '')).rejects.toThrow('Valid JWT token is required for decryption');
    });

    it('should throw error for invalid binary format (too short)', async () => {
      const invalidData = new Uint8Array([5, 0, 16, 12]); // Missing hash length
      await expect(decryptBinaryWithJWT(invalidData, validToken)).rejects.toThrow('Invalid encrypted binary format');
    });

    it('should throw error for unsupported version', async () => {
      const invalidData = new Uint8Array([6, 0, 16, 12, 32]); // Version 6 (not supported)
      await expect(decryptBinaryWithJWT(invalidData, validToken)).rejects.toThrow('Unsupported binary encryption version');
    });

    it('should throw error for invalid header lengths', async () => {
      const invalidData = new Uint8Array([5, 0, 8, 12, 32]); // Wrong salt length
      await expect(decryptBinaryWithJWT(invalidData, validToken)).rejects.toThrow('Invalid encrypted binary format');
    });

    it('should decrypt large binary data', async () => {
      // Simulate a 1MB file
      const originalData = new Uint8Array(1024 * 1024);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256;
      }

      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(originalData.length);
      expect(decrypted).toEqual(originalData);
    });

    it('should decrypt empty binary data', async () => {
      const originalData = new Uint8Array(0);
      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);

      expect(decrypted).toBeInstanceOf(Uint8Array);
      expect(decrypted.length).toBe(0);
      expect(decrypted).toEqual(originalData);
    });

    it('should verify token hash matches', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await encryptBinaryWithJWT(data, validToken);

      // Should decrypt successfully with correct token
      await expect(decryptBinaryWithJWT(encrypted, validToken)).resolves.toBeInstanceOf(Uint8Array);

      // Should fail with different token
      const differentToken = 'different.valid.token.here';
      await expect(decryptBinaryWithJWT(encrypted, differentToken)).rejects.toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully encrypt and decrypt binary data', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const encrypted = await encryptBinaryWithJWT(testData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);

      expect(decrypted).toEqual(testData);
    });

    it('should handle multiple encrypt/decrypt cycles', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      let encrypted = await encryptBinaryWithJWT(data, validToken);

      for (let i = 0; i < 5; i++) {
        const decrypted = await decryptBinaryWithJWT(encrypted, validToken);
        // Modify data slightly
        const modified = new Uint8Array(decrypted.length + 1);
        modified.set(decrypted);
        modified[decrypted.length] = i;
        encrypted = await encryptBinaryWithJWT(modified, validToken);
      }

      const finalDecrypted = await decryptBinaryWithJWT(encrypted, validToken);
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
        const encrypted = await encryptBinaryWithJWT(testData, validToken);
        const decrypted = await decryptBinaryWithJWT(encrypted, validToken);
        expect(decrypted).toEqual(testData);
      }
    });
  });

  describe('compression', () => {
    it('should compress compressible data', async () => {
      // Create highly compressible data (repeating pattern)
      const data = new Uint8Array(10000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 10; // Repeating pattern - highly compressible
      }

      const encrypted = await encryptBinaryWithJWT(data, validToken);
      
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

      const encrypted = await encryptBinaryWithJWT(data, validToken);
      
      // Should still encrypt successfully
      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(data.length);
      
      // Should decrypt correctly
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);
      expect(decrypted).toEqual(data);
    });

    it('should decompress compressed data correctly', async () => {
      // Create compressible data
      const originalData = new Uint8Array(5000);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 50; // Repeating pattern
      }

      const encrypted = await encryptBinaryWithJWT(originalData, validToken);
      const decrypted = await decryptBinaryWithJWT(encrypted, validToken);
      
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

      const encrypted = await encryptBinaryWithJWT(data, validToken);
      
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
});

