/**
 * Unit Tests for Two-Stage Encryption System
 * Tests encryptTwoStage, decryptTwoStage, generateRequestKey, and isDoubleEncrypted
 */

import { describe, it, expect } from 'vitest';
import {
  encryptTwoStage,
  decryptTwoStage,
  generateRequestKey,
  isDoubleEncrypted,
  type TwoStageEncryptedData,
} from './two-stage-encryption.js';

describe('Two-Stage Encryption System', () => {
  const ownerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX293bmVyIiwiZW1haWwiOiJvd25lckBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.owner-signature';
  const requesterToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3JlcXVlc3RlciIsImVtYWlsIjoicmVxdWVzdGVyQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.requester-signature';

  describe('generateRequestKey', () => {
    it('should generate a valid request key', () => {
      const key = generateRequestKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(16);
    });

    it('should generate unique keys', () => {
      const key1 = generateRequestKey();
      const key2 = generateRequestKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate base64 encoded keys', () => {
      const key = generateRequestKey();
      // Base64 strings should only contain valid base64 characters
      expect(key).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe('isDoubleEncrypted', () => {
    it('should return true for double-encrypted data', () => {
      const data: TwoStageEncryptedData = {
        version: 1,
        doubleEncrypted: true,
        stage1: {
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: 'test',
          salt: 'test',
          tokenHash: 'test',
          data: 'test',
        },
        stage2: {
          encrypted: true,
          algorithm: 'AES-GCM-256',
          iv: 'test',
          salt: 'test',
          keyHash: 'test',
          data: 'test',
        },
        timestamp: new Date().toISOString(),
      };

      expect(isDoubleEncrypted(data)).toBe(true);
    });

    it('should return false for non-double-encrypted data', () => {
      expect(isDoubleEncrypted({ encrypted: true })).toBe(false);
      expect(isDoubleEncrypted({ doubleEncrypted: false })).toBe(false);
      expect(isDoubleEncrypted(null)).toBe(false);
      expect(isDoubleEncrypted('string')).toBe(false);
      expect(isDoubleEncrypted(123)).toBe(false);
      expect(isDoubleEncrypted({})).toBe(false);
    });
  });

  describe('encryptTwoStage', () => {
    it('should encrypt data with two-stage encryption', async () => {
      const data = { userId: 'user_123', email: 'test@example.com' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      expect(encrypted).toBeDefined();
      expect(encrypted.version).toBe(1);
      expect(encrypted.doubleEncrypted).toBe(true);
      expect(encrypted.stage1).toBeDefined();
      expect(encrypted.stage2).toBeDefined();
      expect(encrypted.timestamp).toBeDefined();

      // Stage 1 should have JWT encryption metadata
      expect(encrypted.stage1.encrypted).toBe(true);
      expect(encrypted.stage1.algorithm).toBe('AES-GCM-256');
      expect(encrypted.stage1.iv).toBeDefined();
      expect(encrypted.stage1.salt).toBeDefined();
      expect(encrypted.stage1.tokenHash).toBeDefined();
      expect(encrypted.stage1.data).toBeDefined();

      // Stage 2 should have request key encryption metadata
      expect(encrypted.stage2.encrypted).toBe(true);
      expect(encrypted.stage2.algorithm).toBe('AES-GCM-256');
      expect(encrypted.stage2.iv).toBeDefined();
      expect(encrypted.stage2.salt).toBeDefined();
      expect(encrypted.stage2.keyHash).toBeDefined();
      expect(encrypted.stage2.data).toBeDefined();
    });

    it('should throw error for invalid owner token (too short)', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      await expect(encryptTwoStage(data, 'short', requestKey)).rejects.toThrow(
        'Valid data owner JWT token is required for Stage 1 encryption'
      );
    });

    it('should throw error for invalid request key (too short)', async () => {
      const data = { userId: 'user_123' };
      await expect(encryptTwoStage(data, ownerToken, 'short')).rejects.toThrow(
        'Valid request key is required for Stage 2 encryption'
      );
    });

    it('should throw error for empty owner token', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      await expect(encryptTwoStage(data, '', requestKey)).rejects.toThrow(
        'Valid data owner JWT token is required for Stage 1 encryption'
      );
    });

    it('should throw error for empty request key', async () => {
      const data = { userId: 'user_123' };
      await expect(encryptTwoStage(data, ownerToken, '')).rejects.toThrow(
        'Valid request key is required for Stage 2 encryption'
      );
    });

    it('should encrypt different data types', async () => {
      const requestKey = generateRequestKey();
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
        const encrypted = await encryptTwoStage(data, ownerToken, requestKey);
        expect(encrypted.doubleEncrypted).toBe(true);
        expect(encrypted.stage1).toBeDefined();
        expect(encrypted.stage2).toBeDefined();
      }
    });

    it('should generate unique encryption for same data', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted1 = await encryptTwoStage(data, ownerToken, requestKey);
      const encrypted2 = await encryptTwoStage(data, ownerToken, requestKey);

      // Different salt/IV should produce different encrypted data
      expect(encrypted1.stage1.salt).not.toBe(encrypted2.stage1.salt);
      expect(encrypted1.stage1.iv).not.toBe(encrypted2.stage1.iv);
      expect(encrypted1.stage2.salt).not.toBe(encrypted2.stage2.salt);
      expect(encrypted1.stage2.iv).not.toBe(encrypted2.stage2.iv);
      expect(encrypted1.stage2.data).not.toBe(encrypted2.stage2.data);
      // But key hash should be the same
      expect(encrypted1.stage2.keyHash).toBe(encrypted2.stage2.keyHash);
    });
  });

  describe('decryptTwoStage', () => {
    it('should decrypt data with correct owner token and request key', async () => {
      const originalData = { userId: 'user_123', email: 'test@example.com' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(originalData, ownerToken, requestKey);
      const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);

      expect(decrypted).toEqual(originalData);
    });

    it('should throw error for wrong owner token', async () => {
      const originalData = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(originalData, ownerToken, requestKey);
      const wrongToken = 'wrong.owner.token.here';

      await expect(decryptTwoStage(encrypted, wrongToken, requestKey)).rejects.toThrow();
    });

    it('should throw error for wrong request key', async () => {
      const originalData = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(originalData, ownerToken, requestKey);
      const wrongRequestKey = generateRequestKey();

      await expect(decryptTwoStage(encrypted, ownerToken, wrongRequestKey)).rejects.toThrow(
        'Decryption failed - request key does not match'
      );
    });

    it('should throw error for invalid owner token (too short)', async () => {
      const encrypted: TwoStageEncryptedData = {
        version: 1,
        doubleEncrypted: true,
        stage1: { encrypted: true, algorithm: 'AES-GCM-256', iv: 'test', salt: 'test', tokenHash: 'test', data: 'test' },
        stage2: { encrypted: true, algorithm: 'AES-GCM-256', iv: 'test', salt: 'test', keyHash: 'test', data: 'test' },
        timestamp: new Date().toISOString(),
      };
      const requestKey = generateRequestKey();

      await expect(decryptTwoStage(encrypted, 'short', requestKey)).rejects.toThrow(
        'Valid data owner JWT token is required for Stage 1 decryption'
      );
    });

    it('should throw error for invalid request key (too short)', async () => {
      const encrypted: TwoStageEncryptedData = {
        version: 1,
        doubleEncrypted: true,
        stage1: { encrypted: true, algorithm: 'AES-GCM-256', iv: 'test', salt: 'test', tokenHash: 'test', data: 'test' },
        stage2: { encrypted: true, algorithm: 'AES-GCM-256', iv: 'test', salt: 'test', keyHash: 'test', data: 'test' },
        timestamp: new Date().toISOString(),
      };

      await expect(decryptTwoStage(encrypted, ownerToken, 'short')).rejects.toThrow(
        'Valid request key is required for Stage 2 decryption'
      );
    });

    it('should handle non-double-encrypted data (backward compatibility)', async () => {
      // This should fall back to single-stage decryption
      const singleEncrypted = {
        encrypted: true,
        version: 3,
        algorithm: 'AES-GCM-256',
        iv: 'test',
        salt: 'test',
        tokenHash: 'test',
        data: 'test',
      };

      // This will fail because the data is not properly encrypted, but it should attempt single-stage decryption
      await expect(decryptTwoStage(singleEncrypted as any, ownerToken, generateRequestKey())).rejects.toThrow();
    });

    it('should decrypt different data types', async () => {
      const requestKey = generateRequestKey();
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
        const encrypted = await encryptTwoStage(originalData, ownerToken, requestKey);
        const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);
        // Use JSON.stringify for comparison to handle null and primitives correctly
        expect(JSON.stringify(decrypted)).toBe(JSON.stringify(originalData));
      }
    }, 30000); // Increased timeout for multiple encryption/decryption operations

    it('should handle complex nested objects', async () => {
      const requestKey = generateRequestKey();
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

      const encrypted = await encryptTwoStage(complexData, ownerToken, requestKey);
      const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);
      expect(decrypted).toEqual(complexData);
    });

    it('should verify request key hash matches', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      // Should decrypt successfully with correct request key
      await expect(decryptTwoStage(encrypted, ownerToken, requestKey)).resolves.toEqual(data);

      // Should fail with different request key
      const differentRequestKey = generateRequestKey();
      await expect(decryptTwoStage(encrypted, ownerToken, differentRequestKey)).rejects.toThrow(
        'Decryption failed - request key does not match'
      );
    });

    it('should require both owner token and request key', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      // Should fail with requester token (wrong owner token)
      await expect(decryptTwoStage(encrypted, requesterToken, requestKey)).rejects.toThrow();

      // Should fail with wrong request key even with correct owner token
      const wrongRequestKey = generateRequestKey();
      await expect(decryptTwoStage(encrypted, ownerToken, wrongRequestKey)).rejects.toThrow(
        'Decryption failed - request key does not match'
      );
    });
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should successfully encrypt and decrypt data', async () => {
      const requestKey = generateRequestKey();
      const testData = {
        userId: 'user_12345',
        email: 'test@example.com',
        customerId: 'cust_abc123',
        metadata: {
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
      };

      const encrypted = await encryptTwoStage(testData, ownerToken, requestKey);
      const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);

      expect(decrypted).toEqual(testData);
    });

    it('should handle multiple encrypt/decrypt cycles', async () => {
      const requestKey = generateRequestKey();
      const data = { userId: 'user_123', count: 0 };
      let encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      for (let i = 0; i < 3; i++) {
        const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey) as any;
        decrypted.count = i + 1;
        encrypted = await encryptTwoStage(decrypted, ownerToken, requestKey);
      }

      const finalDecrypted = await decryptTwoStage(encrypted, ownerToken, requestKey) as any;
      expect(finalDecrypted.count).toBe(3);
    });
  });

  describe('security properties', () => {
    it('should not allow decryption with requester token', async () => {
      const data = { userId: 'user_123', email: 'owner@example.com' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      // Requester token should not be able to decrypt (even with correct request key)
      await expect(decryptTwoStage(encrypted, requesterToken, requestKey)).rejects.toThrow();
    });

    it('should require both correct owner token and request key', async () => {
      const data = { userId: 'user_123' };
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(data, ownerToken, requestKey);

      // Both must be correct
      await expect(decryptTwoStage(encrypted, ownerToken, requestKey)).resolves.toEqual(data);

      // Wrong owner token
      await expect(decryptTwoStage(encrypted, requesterToken, requestKey)).rejects.toThrow();

      // Wrong request key
      const wrongRequestKey = generateRequestKey();
      await expect(decryptTwoStage(encrypted, ownerToken, wrongRequestKey)).rejects.toThrow(
        'Decryption failed - request key does not match'
      );
    });
  });
});

