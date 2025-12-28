/**
 * Comprehensive Unit Tests for Multi-Stage Encryption System
 * 
 * Tests order-independent decryption, all parties required, and various scenarios
 */

/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  encryptMultiStage,
  decryptMultiStage,
  encryptTwoStage,
  decryptTwoStage,
  generateRequestKey,
  isMultiEncrypted,
  isDoubleEncrypted,
  type EncryptionParty,
  type MultiStageEncryptedData,
  type TwoStageEncryptedData,
} from './multi-stage-encryption.js';

describe('Multi-Stage Encryption System', () => {
  // Test tokens and keys
  const ownerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX293bmVyIiwiZW1haWwiOiJvd25lckBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.owner-signature';
  const requesterToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX3JlcXVlc3RlciIsImVtYWlsIjoicmVxdWVzdGVyQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.requester-signature';
  const auditorToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2F1ZGl0b3IiLCJlbWFpbCI6ImF1ZGl0b3JAZXhhbXBsZS5jb20iLCJleHAiOjk5OTk5OTk5OTl9.auditor-signature';
  const customKey = 'custom-secret-key-12345678901234567890';
  
  const testData = { email: 'user@example.com', userId: 'user_123', sensitive: 'secret data' };

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
      expect(key).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe('isMultiEncrypted / isDoubleEncrypted', () => {
    it('should identify multi-encrypted data', async () => {
      const encrypted = await encryptMultiStage(testData, [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ]);

      expect(isMultiEncrypted(encrypted)).toBe(true);
      expect(isDoubleEncrypted(encrypted)).toBe(false);
    });

    it('should identify double-encrypted data', async () => {
      const encrypted = await encryptTwoStage(testData, ownerToken, generateRequestKey());
      expect(isDoubleEncrypted(encrypted)).toBe(true);
    });

    it('should return false for non-encrypted data', () => {
      expect(isMultiEncrypted(testData)).toBe(false);
      expect(isDoubleEncrypted(testData)).toBe(false);
    });
  });

  describe('encryptMultiStage - Basic Functionality', () => {
    it('should encrypt data with 2 parties', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      expect(encrypted).toBeDefined();
      expect(encrypted.version).toBeGreaterThanOrEqual(3);
      expect(encrypted.multiEncrypted).toBe(true);
      expect(encrypted.stageCount).toBe(2);
      expect(encrypted.stages).toHaveLength(2);
      expect(encrypted.stages[0].stage).toBe(1);
      expect(encrypted.stages[1].stage).toBe(2);
      expect(encrypted.data).toBeDefined(); // Encrypted data + master IV/salt
      expect(encrypted.timestamp).toBeDefined();
    });

    it('should encrypt data with 3 parties', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requesterToken, keyType: 'jwt' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      expect(encrypted.stageCount).toBe(3);
      expect(encrypted.stages).toHaveLength(3);
    });

    it('should encrypt data with 5 parties', async () => {
      const parties: EncryptionParty[] = [
        { id: 'party1', key: ownerToken, keyType: 'jwt' },
        { id: 'party2', key: requesterToken, keyType: 'jwt' },
        { id: 'party3', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'party4', key: customKey, keyType: 'custom' },
        { id: 'party5', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      expect(encrypted.stageCount).toBe(5);
      expect(encrypted.stages).toHaveLength(5);
    });

    it('should throw error for less than 2 parties', async () => {
      await expect(
        encryptMultiStage(testData, [
          { id: 'owner', key: ownerToken, keyType: 'jwt' },
        ])
      ).rejects.toThrow('Multi-stage encryption requires at least 2 parties');
    });

    it('should throw error for more than 10 parties', async () => {
      const parties: EncryptionParty[] = Array.from({ length: 11 }, (_, i) => ({
        id: `party${i + 1}`,
        key: generateRequestKey(),
        keyType: 'request-key' as const,
      }));

      await expect(encryptMultiStage(testData, parties)).rejects.toThrow(
        'Multi-stage encryption supports maximum 10 parties'
      );
    });

    it('should throw error for invalid party key (too short)', async () => {
      await expect(
        encryptMultiStage(testData, [
          { id: 'owner', key: 'short', keyType: 'jwt' },
          { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        ])
      ).rejects.toThrow('Invalid key for party owner');
    });

    it('should throw error for missing party id', async () => {
      await expect(
        encryptMultiStage(testData, [
          { id: '', key: ownerToken, keyType: 'jwt' },
          { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        ])
      ).rejects.toThrow('All parties must have an id');
    });
  });

  describe('decryptMultiStage - Order-Independent Decryption', () => {
    it('should decrypt with parties in encryption order', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(testData);
    });

    it('should decrypt with parties in REVERSE order (order-independent!)', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      
      // Decrypt with parties in reverse order
      const reverseParties: EncryptionParty[] = [
        { id: 'requester', key: parties[1].key, keyType: 'request-key' },
        { id: 'owner', key: parties[0].key, keyType: 'jwt' },
      ];

      const decrypted = await decryptMultiStage(encrypted, reverseParties);
      expect(decrypted).toEqual(testData);
    });

    it('should decrypt with parties in RANDOM order (order-independent!)', async () => {
      const parties: EncryptionParty[] = [
        { id: 'party1', key: ownerToken, keyType: 'jwt' },
        { id: 'party2', key: requesterToken, keyType: 'jwt' },
        { id: 'party3', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      
      // Decrypt with parties in random order: 3, 1, 2
      const randomOrderParties: EncryptionParty[] = [
        { id: 'party3', key: parties[2].key, keyType: 'request-key' },
        { id: 'party1', key: parties[0].key, keyType: 'jwt' },
        { id: 'party2', key: parties[1].key, keyType: 'jwt' },
      ];

      const decrypted = await decryptMultiStage(encrypted, randomOrderParties);
      expect(decrypted).toEqual(testData);
    });

    it('should require ALL parties to decrypt', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Try to decrypt with only 2 parties (should fail)
      await expect(
        decryptMultiStage(encrypted, [
          { id: 'owner', key: ownerToken, keyType: 'jwt' },
          { id: 'requester', key: parties[1].key, keyType: 'request-key' },
        ])
      ).rejects.toThrow('Decryption requires exactly 3 parties');
    });

    it('should fail if any party key is missing', async () => {
      const requestKey = generateRequestKey();
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requestKey, keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Try to decrypt with wrong key for requester
      await expect(
        decryptMultiStage(encrypted, [
          { id: 'owner', key: ownerToken, keyType: 'jwt' },
          { id: 'requester', key: generateRequestKey(), keyType: 'request-key' }, // Wrong key!
        ])
      ).rejects.toThrow('Decryption failed');
    });

    it('should fail if owner key is wrong', async () => {
      const requestKey = generateRequestKey();
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requestKey, keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Try to decrypt with wrong owner token
      await expect(
        decryptMultiStage(encrypted, [
          { id: 'owner', key: requesterToken, keyType: 'jwt' }, // Wrong token!
          { id: 'requester', key: requestKey, keyType: 'request-key' },
        ])
      ).rejects.toThrow('Decryption failed');
    });

    it('should verify all parties can decrypt their master keys', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // All parties must successfully decrypt - this is verified internally
      const decrypted = await decryptMultiStage(encrypted, parties);
      expect(decrypted).toEqual(testData);
    });

    it('should fail if one party cannot decrypt their master key', async () => {
      const requestKey = generateRequestKey();
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requestKey, keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Try with wrong auditor key
      await expect(
        decryptMultiStage(encrypted, [
          { id: 'owner', key: ownerToken, keyType: 'jwt' },
          { id: 'requester', key: requestKey, keyType: 'request-key' },
          { id: 'auditor', key: 'wrong-custom-key-12345678901234567890', keyType: 'custom' },
        ])
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('decryptMultiStage - Key Type Verification', () => {
    it('should verify key types match', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Try with wrong key type
      await expect(
        decryptMultiStage(encrypted, [
          { id: 'owner', key: ownerToken, keyType: 'jwt' },
          { id: 'requester', key: generateRequestKey(), keyType: 'custom' }, // Wrong type!
        ])
      ).rejects.toThrow('key type mismatch');
    });
  });

  describe('encryptTwoStage / decryptTwoStage - Backward Compatibility', () => {
    it('should encrypt and decrypt with two-stage encryption', async () => {
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(testData, ownerToken, requestKey);
      const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);

      expect(decrypted).toEqual(testData);
    });

    it('should handle two-stage encryption with different data types', async () => {
      const requestKey = generateRequestKey();
      
      const testCases = [
        'simple string',
        { nested: { data: 'value' } },
        ['array', 'of', 'items'],
        12345,
        null,
      ];

      for (const data of testCases) {
        const encrypted = await encryptTwoStage(data, ownerToken, requestKey);
        const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);
        expect(decrypted).toEqual(data);
      }
    });

    it('should fail two-stage decryption with wrong owner token', async () => {
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(testData, ownerToken, requestKey);

      await expect(
        decryptTwoStage(encrypted, requesterToken, requestKey) // Wrong token!
      ).rejects.toThrow();
    });

    it('should fail two-stage decryption with wrong request key', async () => {
      const requestKey = generateRequestKey();
      const encrypted = await encryptTwoStage(testData, ownerToken, requestKey);

      await expect(
        decryptTwoStage(encrypted, ownerToken, generateRequestKey()) // Wrong key!
      ).rejects.toThrow();
    });
  });

  describe('Multi-Stage Encryption - Different Key Types', () => {
    it('should work with all JWT tokens', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requesterToken, keyType: 'jwt' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(testData);
    });

    it('should work with all request keys', async () => {
      const parties: EncryptionParty[] = [
        { id: 'party1', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'party2', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(testData);
    });

    it('should work with all custom keys', async () => {
      const parties: EncryptionParty[] = [
        { id: 'party1', key: customKey, keyType: 'custom' },
        { id: 'party2', key: 'another-custom-key-12345678901234567890', keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(testData);
    });

    it('should work with mixed key types', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(testData);
    });
  });

  describe('Multi-Stage Encryption - Edge Cases', () => {
    it('should handle empty object', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage({}, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual({});
    });

    it('should handle large data objects', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          data: 'x'.repeat(100),
        })),
      };

      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(largeData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(largeData);
    });

    it('should handle special characters in data', async () => {
      const specialData = {
        unicode: '[DEPLOY] 测试 日本語',
        special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        newlines: 'line1\nline2\r\nline3',
        quotes: "single ' and double \" quotes",
      };

      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(specialData, parties);
      const decrypted = await decryptMultiStage(encrypted, parties);

      expect(decrypted).toEqual(specialData);
    });

    it('should produce different encrypted output for same data', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted1 = await encryptMultiStage(testData, parties);
      const encrypted2 = await encryptMultiStage(testData, parties);

      // Should be different due to random salt/IV
      expect(encrypted1.stages[0].iv).not.toBe(encrypted2.stages[0].iv);
      expect(encrypted1.stages[0].salt).not.toBe(encrypted2.stages[0].salt);
      expect(encrypted1.data).not.toBe(encrypted2.data);

      // But both should decrypt to the same data
      const decrypted1 = await decryptMultiStage(encrypted1, parties);
      const decrypted2 = await decryptMultiStage(encrypted2, parties);
      expect(decrypted1).toEqual(testData);
      expect(decrypted2).toEqual(testData);
    });
  });

  describe('Multi-Stage Encryption - Security Properties', () => {
    it('should verify all master keys match (data integrity)', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // All parties should decrypt to the same master key
      // This is verified internally in decryptMultiStage
      const decrypted = await decryptMultiStage(encrypted, parties);
      expect(decrypted).toEqual(testData);
    });

    it('should fail if master keys do not match (tampering detection)', async () => {
      // This test verifies that if someone tampers with the encrypted data,
      // the master keys won't match and decryption will fail
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
      ];

      const encrypted = await encryptMultiStage(testData, parties);

      // Tamper with one of the encrypted master keys
      const tampered = {
        ...encrypted,
        stages: encrypted.stages.map((stage, i) =>
          i === 0
            ? { ...stage, data: stage.data.slice(0, -10) + 'TAMPERED' }
            : stage
        ),
      };

      await expect(decryptMultiStage(tampered, parties)).rejects.toThrow();
    });
  });

  describe('Multi-Stage Encryption - Real-World Scenarios', () => {
    it('should handle user email encryption scenario', async () => {
      const userEmail = 'user@example.com';
      const ownerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.token';
      const requestKey = generateRequestKey();

      const encrypted = await encryptTwoStage(userEmail, ownerToken, requestKey);
      const decrypted = await decryptTwoStage(encrypted, ownerToken, requestKey);

      expect(decrypted).toBe(userEmail);
    });

    it('should handle multi-party data sharing scenario', async () => {
      const sensitiveData = {
        userId: 'user_123',
        email: 'user@example.com',
        preferences: { theme: 'dark', notifications: true },
      };

      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt', label: 'Data Owner' },
        { id: 'requester', key: requesterToken, keyType: 'jwt', label: 'Requester' },
        { id: 'auditor', key: customKey, keyType: 'custom', label: 'Auditor' },
      ];

      const encrypted = await encryptMultiStage(sensitiveData, parties);

      // All parties must provide keys (order doesn't matter)
      const decrypted = await decryptMultiStage(encrypted, [
        { id: 'auditor', key: customKey, keyType: 'custom' },
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: requesterToken, keyType: 'jwt' },
      ]);

      expect(decrypted).toEqual(sensitiveData);
    });
  });

  describe('Multi-Stage Encryption - Performance', () => {
    it('should complete encryption/decryption in reasonable time', async () => {
      const parties: EncryptionParty[] = [
        { id: 'owner', key: ownerToken, keyType: 'jwt' },
        { id: 'requester', key: generateRequestKey(), keyType: 'request-key' },
        { id: 'auditor', key: customKey, keyType: 'custom' },
      ];

      const startEncrypt = Date.now();
      const encrypted = await encryptMultiStage(testData, parties);
      const encryptTime = Date.now() - startEncrypt;

      const startDecrypt = Date.now();
      const decrypted = await decryptMultiStage(encrypted, parties);
      const decryptTime = Date.now() - startDecrypt;

      // Should complete in under 5 seconds (PBKDF2 is slow but should be reasonable)
      expect(encryptTime).toBeLessThan(5000);
      expect(decryptTime).toBeLessThan(5000);
      expect(decrypted).toEqual(testData);
    });
  });
});

