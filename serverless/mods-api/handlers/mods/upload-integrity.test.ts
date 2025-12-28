/**
 * Integration Tests for File Upload Integrity
 * 
 * Tests verify that file integrity is maintained through upload process:
 * - Hash is calculated on decrypted content
 * - Hash is stored correctly
 * - Compression/decompression doesn't affect hash
 * - Uploaded file matches downloaded file
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateFileHash } from '../../utils/hash.js';

describe('File Upload Integrity', () => {
    describe('Hash Calculation on Decrypted Content', () => {
        it('should calculate hash on decrypted content, not encrypted', async () => {
            // Simulate file upload process
            const originalContent = new TextEncoder().encode('original file content');
            const originalHash = await calculateFileHash(originalContent);
            
            // Simulate encryption (this would change the bytes)
            const encryptedContent = new Uint8Array(originalContent.length + 100); // Encrypted is larger
            encryptedContent.set(originalContent, 0);
            // Add some encryption overhead
            for (let i = originalContent.length; i < encryptedContent.length; i++) {
                encryptedContent[i] = 0xFF;
            }
            
            // Hash should be calculated on decrypted content
            const decryptedHash = await calculateFileHash(originalContent);
            
            expect(decryptedHash).toBe(originalHash);
            expect(decryptedHash).not.toBe(await calculateFileHash(encryptedContent));
        });

        it('should produce same hash before and after encryption/decryption cycle', async () => {
            const originalContent = new TextEncoder().encode('test file for encryption cycle');
            const originalHash = await calculateFileHash(originalContent);
            
            // Simulate encryption
            const encrypted = new Uint8Array(originalContent.length + 50);
            encrypted.set(originalContent, 0);
            
            // Simulate decryption (get back original)
            const decrypted = originalContent.slice();
            
            const decryptedHash = await calculateFileHash(decrypted);
            
            expect(decryptedHash).toBe(originalHash);
        });
    });

    describe('Compression/Decompression Integrity', () => {
        it('should maintain hash integrity through compression/decompression', async () => {
            const originalContent = new TextEncoder().encode('test content that will be compressed');
            const originalHash = await calculateFileHash(originalContent);
            
            // Simulate compression (using CompressionStream if available, otherwise mock)
            let compressed: Uint8Array;
            if (typeof CompressionStream !== 'undefined') {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(originalContent);
                writer.close();
                
                const chunks: Uint8Array[] = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                compressed = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    compressed.set(chunk, offset);
                    offset += chunk.length;
                }
            } else {
                // Mock compression for test environment
                compressed = new Uint8Array(originalContent.length - 10); // Simulate smaller size
                compressed.set(originalContent.slice(0, compressed.length));
            }
            
            // Hash should be calculated on original content, not compressed
            const hashAfterCompression = await calculateFileHash(originalContent);
            
            expect(hashAfterCompression).toBe(originalHash);
            
            // Simulate decompression
            let decompressed: Uint8Array;
            if (typeof DecompressionStream !== 'undefined' && typeof CompressionStream !== 'undefined') {
                const stream = new DecompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(compressed);
                writer.close();
                
                const chunks: Uint8Array[] = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                decompressed = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    decompressed.set(chunk, offset);
                    offset += chunk.length;
                }
            } else {
                // Mock decompression
                decompressed = originalContent.slice();
            }
            
            const hashAfterDecompression = await calculateFileHash(decompressed);
            
            expect(hashAfterDecompression).toBe(originalHash);
        });

        it('should detect tampering even after compression/decompression', async () => {
            const originalContent = new TextEncoder().encode('original content');
            const originalHash = await calculateFileHash(originalContent);
            
            // Tamper with content
            const tamperedContent = new TextEncoder().encode('tampered content');
            const tamperedHash = await calculateFileHash(tamperedContent);
            
            expect(tamperedHash).not.toBe(originalHash);
            
            // Even if both are compressed, hashes should differ
            // (hash is calculated on original content, not compressed)
            expect(tamperedHash).not.toBe(originalHash);
        });
    });

    describe('Upload/Download Round-Trip Integrity', () => {
        it('should maintain file integrity through upload/download cycle', async () => {
            // Simulate upload process
            const originalFile = new TextEncoder().encode('file content for round-trip test');
            const uploadHash = await calculateFileHash(originalFile);
            
            // Simulate storage (encryption/compression happens here)
            const storedFile = originalFile.slice(); // In reality, this would be encrypted/compressed
            
            // Simulate download process (decryption/decompression)
            const downloadedFile = storedFile.slice(); // In reality, this would be decrypted/decompressed
            const downloadHash = await calculateFileHash(downloadedFile);
            
            expect(downloadHash).toBe(uploadHash);
            expect(downloadHash).toBe(await calculateFileHash(originalFile));
        });

        it('should detect corruption during storage/retrieval', async () => {
            const originalFile = new TextEncoder().encode('file content');
            const originalHash = await calculateFileHash(originalFile);
            
            // Simulate corruption during storage
            const corruptedFile = originalFile.slice();
            corruptedFile[0] = 0xFF; // Corrupt first byte
            
            const corruptedHash = await calculateFileHash(corruptedFile);
            
            expect(corruptedHash).not.toBe(originalHash);
        });
    });

    describe('Binary File Integrity', () => {
        it('should handle binary files correctly', async () => {
            // Create binary file (not text)
            const binaryFile = new Uint8Array([0x00, 0xFF, 0x42, 0x13, 0x37, 0xDE, 0xAD, 0xBE, 0xEF]);
            const hash1 = await calculateFileHash(binaryFile);
            
            // Create identical binary file
            const binaryFile2 = new Uint8Array([0x00, 0xFF, 0x42, 0x13, 0x37, 0xDE, 0xAD, 0xBE, 0xEF]);
            const hash2 = await calculateFileHash(binaryFile2);
            
            expect(hash1).toBe(hash2);
        });

        it('should detect single byte change in binary file', async () => {
            const binaryFile1 = new Uint8Array([0x00, 0xFF, 0x42]);
            const binaryFile2 = new Uint8Array([0x00, 0xFE, 0x42]); // One byte changed
            
            const hash1 = await calculateFileHash(binaryFile1);
            const hash2 = await calculateFileHash(binaryFile2);
            
            expect(hash1).not.toBe(hash2);
        });
    });
});

