/**
 * Unit Tests for JWT Encryption Utilities
 * Tests encryptWithJWT and decryptWithJWT functions
 */

import { describe, it, expect } from 'vitest';
// Uses shared encryption suite from serverless/shared/encryption
import { encryptWithJWT, decryptWithJWT } from '@strixun/api-framework';

describe('JWT Encryption Utilities', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMzQ1NiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.test-signature';

  describe('encryptWithJWT', () => {
    it('should encrypt data with valid JWT token', async () => {
      const data = { userId: 'user_123', email: 'test@example.com' };
      const encrypted = await encryptWithJWT(data, validToken);

      expect(encrypted).toBeDefined();
      expect(encrypted.version).toBe(3);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('AES-GCM-256');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.tokenHash).toBeDefined();
      expect(encrypted.data).toBeDefined();
      expect(encrypted.timestamp).toBeDefined();
    });

    it('should throw error for invalid token (too short)', async () => {
      const data = { userId: 'user_123' };
      await expect(encryptWithJWT(data, 'short')).rejects.toThrow('Valid JWT token is required for encryption');
    });

    it('should throw error for empty token', async () => {
      const data = { userId: 'user_123' };
      await expect(encryptWithJWT(data, '')).rejects.toThrow('Valid JWT token is required for encryption');
    });

    it('should throw error for null token', async () => {
      const data = { userId: 'user_123' };
      await expect(encryptWithJWT(data, null as any)).rejects.toThrow('Valid JWT token is required for encryption');
    });

    it('should encrypt different data types', async () => {
      const testCases = [
        { userId: 'user_123' },
        { email: 'test@example.com', name: 'Test User' },
        ['array', 'of', 'strings'],
        12345,
        'simple string',
        null,
        true,
      ];

      for (const data of testCases) {
        const encrypted = await encryptWithJWT(data, validToken);
        expect(encrypted.encrypted).toBe(true);
        expect(encrypted.data).toBeDefined();
      }
    });

    it('should generate unique encryption for same data', async () => {
      const data = { userId: 'user_123' };
      const encrypted1 = await encryptWithJWT(data, validToken);
      const encrypted2 = await encryptWithJWT(data, validToken);

      // Different salt/IV should produce different encrypted data
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.data).not.toBe(encrypted2.data);
      // But token hash should be the same
      expect(encrypted1.tokenHash).toBe(encrypted2.tokenHash);
    });
  });

  describe('decryptWithJWT', () => {
    it('should decrypt data with correct token', async () => {
      const originalData = { userId: 'user_123', email: 'test@example.com' };
      const encrypted = await encryptWithJWT(originalData, validToken);
      const decrypted = await decryptWithJWT(encrypted, validToken);

      expect(decrypted).toEqual(originalData);
    });

    it('should throw error for wrong token', async () => {
      const originalData = { userId: 'user_123' };
      const encrypted = await encryptWithJWT(originalData, validToken);
      const wrongToken = 'wrong.token.here';

      await expect(decryptWithJWT(encrypted, wrongToken)).rejects.toThrow();
    });

    it('should throw error for invalid token (too short)', async () => {
      const encrypted = { encrypted: true, data: 'test' };
      await expect(decryptWithJWT(encrypted as any, 'short')).rejects.toThrow('Valid JWT token is required for decryption');
    });

    it('should throw error for empty token', async () => {
      const encrypted = { encrypted: true, data: 'test' };
      await expect(decryptWithJWT(encrypted as any, '')).rejects.toThrow('Valid JWT token is required for decryption');
    });

    it('should return unencrypted data as-is (backward compatibility)', async () => {
      const unencryptedData = { userId: 'user_123', encrypted: false };
      const result = await decryptWithJWT(unencryptedData as any, validToken);
      expect(result).toEqual(unencryptedData);
    });

    it('should decrypt different data types', async () => {
      const testCases = [
        { userId: 'user_123' },
        { email: 'test@example.com', name: 'Test User' },
        ['array', 'of', 'strings'],
        12345,
        'simple string',
        null,
        true,
      ];

      for (const originalData of testCases) {
        const encrypted = await encryptWithJWT(originalData, validToken);
        const decrypted = await decryptWithJWT(encrypted, validToken);
        expect(decrypted).toEqual(originalData);
      }
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        user: {
          id: 'user_123',
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          createdAt: '2024-01-01',
          tags: ['tag1', 'tag2'],
        },
      };

      const encrypted = await encryptWithJWT(complexData, validToken);
      const decrypted = await decryptWithJWT(encrypted, validToken);
      expect(decrypted).toEqual(complexData);
    });

    it('should verify token hash matches', async () => {
      const data = { userId: 'user_123' };
      const encrypted = await encryptWithJWT(data, validToken);

      // Should decrypt successfully with correct token
      await expect(decryptWithJWT(encrypted, validToken)).resolves.toEqual(data);

      // Should fail with different token
      const differentToken = 'different.valid.token.here';
      await expect(decryptWithJWT(encrypted, differentToken)).rejects.toThrow();
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully encrypt and decrypt data', async () => {
      const testData = {
        userId: 'user_12345',
        email: 'test@example.com',
        customerId: 'cust_abc123',
        metadata: {
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
      };

      const encrypted = await encryptWithJWT(testData, validToken);
      const decrypted = await decryptWithJWT(encrypted, validToken);

      expect(decrypted).toEqual(testData);
    });

    it('should handle multiple encrypt/decrypt cycles', async () => {
      const data = { userId: 'user_123', count: 0 };
      let encrypted = await encryptWithJWT(data, validToken);

      for (let i = 0; i < 5; i++) {
        const decrypted = await decryptWithJWT(encrypted, validToken) as any;
        decrypted.count = i + 1;
        encrypted = await encryptWithJWT(decrypted, validToken);
      }

      const finalDecrypted = await decryptWithJWT(encrypted, validToken) as any;
      expect(finalDecrypted.count).toBe(5);
    });
  });
});

