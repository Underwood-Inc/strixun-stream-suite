/**
 * Unit Tests for File Integrity Hash Utilities
 * 
 * Tests verify that file hashing works correctly for integrity verification:
 * - SHA-256 hash calculation
 * - Strixun hash formatting
 * - Hash parsing and validation
 * - Consistency across different input types
 */

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    calculateFileHash,
    calculateStrixunHash,
    verifyStrixunHash,
    formatStrixunHash,
    parseStrixunHash,
} from './hash.js';

describe('File Integrity Hash Utilities', () => {
    describe('calculateFileHash', () => {
        it('should calculate hash for ArrayBuffer', async () => {
            const data = new TextEncoder().encode('test file content');
            const hash = await calculateFileHash(data.buffer);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
        });

        it('should calculate hash for Uint8Array', async () => {
            const data = new TextEncoder().encode('test file content');
            const hash = await calculateFileHash(data);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64);
        });

        it('should calculate hash for File', async () => {
            const content = 'test file content';
            const blob = new Blob([content], { type: 'text/plain' });
            const file = new File([blob], 'test.txt', { type: 'text/plain' });
            
            const hash = await calculateFileHash(file);
            
            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64);
        });

        it('should produce same hash for same content', async () => {
            const content = 'identical content';
            const data1 = new TextEncoder().encode(content);
            const data2 = new TextEncoder().encode(content);
            
            const hash1 = await calculateFileHash(data1);
            const hash2 = await calculateFileHash(data2);
            
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different content', async () => {
            const data1 = new TextEncoder().encode('content 1');
            const data2 = new TextEncoder().encode('content 2');
            
            const hash1 = await calculateFileHash(data1);
            const hash2 = await calculateFileHash(data2);
            
            expect(hash1).not.toBe(hash2);
        });

        it('should produce deterministic hash (same input = same output)', async () => {
            const data = new TextEncoder().encode('deterministic test');
            
            const hash1 = await calculateFileHash(data);
            const hash2 = await calculateFileHash(data);
            const hash3 = await calculateFileHash(data);
            
            expect(hash1).toBe(hash2);
            expect(hash2).toBe(hash3);
        });

        it('should handle empty file', async () => {
            const data = new Uint8Array(0);
            const hash = await calculateFileHash(data);
            
            expect(hash).toBeDefined();
            expect(hash.length).toBe(64);
            // Empty file should have a known hash (e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
            expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        });

        it('should handle large files', async () => {
            // Create a 1MB file
            const size = 1024 * 1024;
            const data = new Uint8Array(size);
            // Fill with pattern
            for (let i = 0; i < size; i++) {
                data[i] = i % 256;
            }
            
            const hash = await calculateFileHash(data);
            
            expect(hash).toBeDefined();
            expect(hash.length).toBe(64);
        });

        it('should detect single byte change', async () => {
            const data1 = new TextEncoder().encode('test content');
            const data2 = new TextEncoder().encode('test content');
            data2[0] = 0xFF; // Change first byte
            
            const hash1 = await calculateFileHash(data1);
            const hash2 = await calculateFileHash(data2);
            
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('formatStrixunHash', () => {
        it('should format hash with strixun prefix', () => {
            const hash = 'a'.repeat(64);
            const formatted = formatStrixunHash(hash);
            
            expect(formatted).toBe(`strixun:sha256:${hash}`);
        });

        it('should preserve hash case', () => {
            const hash = 'A'.repeat(64);
            const formatted = formatStrixunHash(hash);
            
            expect(formatted).toBe(`strixun:sha256:${hash}`);
        });

        it('should handle lowercase hash', () => {
            const hash = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
            const formatted = formatStrixunHash(hash);
            
            expect(formatted).toBe(`strixun:sha256:${hash}`);
        });
    });

    describe('parseStrixunHash', () => {
        it('should parse valid Strixun hash', () => {
            const hash = 'a'.repeat(64);
            const identifier = `strixun:sha256:${hash}`;
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBe(hash.toLowerCase());
        });

        it('should return null for invalid prefix', () => {
            const identifier = 'invalid:sha256:abc123';
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBeNull();
        });

        it('should return null for invalid hash length', () => {
            const identifier = 'strixun:sha256:short';
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBeNull();
        });

        it('should return null for non-hex characters', () => {
            const identifier = 'strixun:sha256:' + 'g'.repeat(64); // 'g' is not valid hex
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBeNull();
        });

        it('should normalize to lowercase', () => {
            const hash = 'A'.repeat(64);
            const identifier = `strixun:sha256:${hash}`;
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBe(hash.toLowerCase());
        });

        it('should handle valid hex with mixed case', () => {
            const hash = 'aBcDeF0123456789'.repeat(4); // 64 characters
            const identifier = `strixun:sha256:${hash}`;
            const parsed = parseStrixunHash(identifier);
            
            expect(parsed).toBe(hash.toLowerCase());
        });
    });

    describe('calculateStrixunHash (HMAC-SHA256)', () => {
        const mockEnv = {
            FILE_INTEGRITY_KEYPHRASE: 'test-keyphrase-123',
        };

        it('should calculate HMAC-SHA256 signature', async () => {
            const data = new TextEncoder().encode('test file content');
            const signature = await calculateStrixunHash(data, mockEnv);
            
            expect(signature).toBeDefined();
            expect(typeof signature).toBe('string');
            expect(signature.length).toBe(64);
        });

        it('should produce same signature for same content with same keyphrase', async () => {
            const content = 'identical content';
            const data1 = new TextEncoder().encode(content);
            const data2 = new TextEncoder().encode(content);
            
            const sig1 = await calculateStrixunHash(data1, mockEnv);
            const sig2 = await calculateStrixunHash(data2, mockEnv);
            
            expect(sig1).toBe(sig2);
        });

        it('should produce different signature with different keyphrase', async () => {
            const data = new TextEncoder().encode('test content');
            const env1 = { FILE_INTEGRITY_KEYPHRASE: 'keyphrase-1' };
            const env2 = { FILE_INTEGRITY_KEYPHRASE: 'keyphrase-2' };
            
            const sig1 = await calculateStrixunHash(data, env1);
            const sig2 = await calculateStrixunHash(data, env2);
            
            expect(sig1).not.toBe(sig2);
        });

        it('should produce different signature than plain SHA-256', async () => {
            const data = new TextEncoder().encode('test content');
            const plainHash = await calculateFileHash(data);
            const hmacSignature = await calculateStrixunHash(data, mockEnv);
            
            expect(plainHash).not.toBe(hmacSignature);
        });
    });

    describe('verifyStrixunHash', () => {
        const mockEnv = {
            FILE_INTEGRITY_KEYPHRASE: 'test-keyphrase-123',
        };

        it('should verify correct signature', async () => {
            const data = new TextEncoder().encode('test file');
            const signature = await calculateStrixunHash(data, mockEnv);
            const isValid = await verifyStrixunHash(data, signature, mockEnv);
            
            expect(isValid).toBe(true);
        });

        it('should reject incorrect signature', async () => {
            const data = new TextEncoder().encode('test file');
            const wrongSignature = 'a'.repeat(64);
            const isValid = await verifyStrixunHash(data, wrongSignature, mockEnv);
            
            expect(isValid).toBe(false);
        });
    });

    describe('Hash Integrity Verification', () => {
        it('should detect tampering (single byte change)', async () => {
            const original = new TextEncoder().encode('original file content');
            const tampered = new TextEncoder().encode('original file content');
            tampered[5] = 0xFF; // Tamper with one byte
            
            const originalHash = await calculateFileHash(original);
            const tamperedHash = await calculateFileHash(tampered);
            
            expect(originalHash).not.toBe(tamperedHash);
        });

        it('should verify file integrity (round-trip)', async () => {
            const original = new TextEncoder().encode('file content for integrity test');
            const originalHash = await calculateFileHash(original);
            
            // Simulate file storage and retrieval
            const stored = new Uint8Array(original);
            const retrievedHash = await calculateFileHash(stored);
            
            expect(originalHash).toBe(retrievedHash);
        });

        it('should verify hash format consistency', () => {
            const hash = 'a'.repeat(64);
            const formatted = formatStrixunHash(hash);
            const parsed = parseStrixunHash(formatted);
            
            expect(parsed).toBe(hash.toLowerCase());
        });

        it('should handle binary data integrity', async () => {
            // Create binary data (not text)
            const binaryData = new Uint8Array([0x00, 0xFF, 0x42, 0x13, 0x37, 0xDE, 0xAD, 0xBE, 0xEF]);
            const hash1 = await calculateFileHash(binaryData);
            
            // Create identical binary data
            const binaryData2 = new Uint8Array([0x00, 0xFF, 0x42, 0x13, 0x37, 0xDE, 0xAD, 0xBE, 0xEF]);
            const hash2 = await calculateFileHash(binaryData2);
            
            expect(hash1).toBe(hash2);
        });
    });
});

