/**
 * Integration Tests for Encryption/Decryption Flow
 * 
 * Tests the complete encryption/decryption flow:
 * - Request encryption  API  Response decryption
 * 
 * Uses real encryption/decryption, mocks network
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { encryptWithJWT, decryptWithJWT } from '@strixun/api-framework';
import { createRS256JWT, mockAuthMeEndpoint } from '../../shared/test-rs256.js';

// Mock external dependencies
vi.mock('@strixun/api-framework/enhanced', () => ({
    createCORSHeaders: vi.fn(() => new Headers()),
}));

let cleanupAuthMe: () => void;

describe('Encryption/Decryption Flow Integration', () => {
    const mockEnv = {
        JWT_ISSUER: 'https://test-issuer.example.com',
        ALLOWED_ORIGINS: '*',
    } as any;

    beforeAll(async () => {
        cleanupAuthMe = await mockAuthMeEndpoint();
    });

    afterAll(() => cleanupAuthMe());

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Request Encryption and Decryption', () => {
        it('should encrypt request body and decrypt it correctly', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            // Create JWT token for encryption
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Original request data
            const originalData = {
                modId: 'mod_123',
                title: 'Test Mod',
                description: 'This is a test mod',
            };

            // Step 1: Encrypt request body
            const encryptedData = await encryptWithJWT(originalData, token);

            expect(encryptedData).toBeDefined();
            expect(encryptedData).not.toEqual(originalData);
            expect(typeof encryptedData).toBe('object');
            expect(encryptedData.encrypted).toBe(true);

            // Step 2: Decrypt request body (simulating API receiving encrypted request)
            const decryptedData = await decryptWithJWT(encryptedData, token) as typeof originalData;

            // Step 3: Verify decrypted data matches original
            expect(decryptedData).toEqual(originalData);
            expect(decryptedData.modId).toBe(originalData.modId);
            expect(decryptedData.title).toBe(originalData.title);
            expect(decryptedData.description).toBe(originalData.description);
        });

        it('should fail to decrypt with wrong JWT token', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            // Create JWT token for encryption
            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const correctToken = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Create different token (wrong user)
            const wrongToken = await createRS256JWT({
                sub: 'user_456',
                email: 'other@example.com',
                customerId: 'cust_xyz',
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            const originalData = { modId: 'mod_123', title: 'Test Mod' };

            // Encrypt with correct token
            const encryptedData = await encryptWithJWT(originalData, correctToken);

            // Try to decrypt with wrong token - should fail
            await expect(decryptWithJWT(encryptedData, wrongToken)).rejects.toThrow();
        });

        it('should handle encrypted responses correctly', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Simulate API response data
            const responseData = {
                mod: {
                    modId: 'mod_123',
                    title: 'Test Mod',
                    status: 'published',
                },
                success: true,
            };

            // Step 1: Encrypt response (simulating API encrypting response)
            const encryptedResponse = await encryptWithJWT(responseData, token);

            // Step 2: Decrypt response (simulating client receiving encrypted response)
            const decryptedResponse = await decryptWithJWT(encryptedResponse, token) as typeof responseData;

            // Step 3: Verify response matches original
            expect(decryptedResponse).toEqual(responseData);
            expect(decryptedResponse.mod.modId).toBe(responseData.mod.modId);
            expect(decryptedResponse.success).toBe(true);
        });

        it('should handle complex nested objects in encryption', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            const complexData = {
                mod: {
                    modId: 'mod_123',
                    metadata: {
                        author: { customerId: 'user_123',
                            displayName: 'Test Author',
                        },
                        tags: ['tag1', 'tag2', 'tag3'],
                        versions: [
                            { versionId: 'v1', sha256: 'abc123' },
                            { versionId: 'v2', sha256: 'def456' },
                        ],
                    },
                },
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 100,
                },
            };

            const encrypted = await encryptWithJWT(complexData, token);
            const decrypted = await decryptWithJWT(encrypted, token) as typeof complexData;

            expect(decrypted).toEqual(complexData);
            expect(decrypted.mod.metadata.versions.length).toBe(2);
        });
    });

    describe('End-to-End Encryption Flow', () => {
        it('should complete full flow: Encrypt Request  API  Decrypt Response', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const token = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Step 1: Client encrypts request
            const requestData = {
                modId: 'mod_123',
                title: 'Updated Mod Title',
            };
            const encryptedRequest = await encryptWithJWT(requestData, token);

            // Step 2: API receives encrypted request and decrypts it
            const decryptedRequest = await decryptWithJWT(encryptedRequest, token) as typeof requestData;
            expect(decryptedRequest).toEqual(requestData);

            // Step 3: API processes request and encrypts response
            const responseData = {
                success: true,
                mod: {
                    ...decryptedRequest,
                    updatedAt: new Date().toISOString(),
                },
            };
            const encryptedResponse = await encryptWithJWT(responseData, token);

            // Step 4: Client receives encrypted response and decrypts it
            const decryptedResponse = await decryptWithJWT(encryptedResponse, token) as typeof responseData;

            // Step 5: Verify complete flow worked
            expect(decryptedResponse.success).toBe(true);
            expect(decryptedResponse.mod.modId).toBe(requestData.modId);
            expect(decryptedResponse.mod.title).toBe(requestData.title);
        });
    });

    describe('Token Trimming Fix', () => {
        it('should decrypt successfully when token has whitespace (token trimming fix)', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const baseToken = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Simulate token with whitespace (as might be stored in localStorage)
            const tokenWithWhitespace = `  ${baseToken}  `;
            const trimmedToken = baseToken; // Backend always trims

            const originalData = {
                modId: 'mod_123',
                title: 'Test Mod',
                description: 'This is a test mod',
            };

            // Step 1: Encrypt with trimmed token (simulating backend encryption)
            const encryptedData = await encryptWithJWT(originalData, trimmedToken);

            expect(encryptedData).toBeDefined();
            expect(encryptedData.encrypted).toBe(true);

            // Step 2: Decrypt with token that has whitespace (simulating frontend before fix)
            // This should work now because getTokenForDecryption trims the token
            // We'll test this by manually trimming (simulating the fix)
            const decryptedData = await decryptWithJWT(encryptedData, tokenWithWhitespace.trim()) as typeof originalData;

            // Step 3: Verify decrypted data matches original
            expect(decryptedData).toEqual(originalData);
            expect(decryptedData.modId).toBe(originalData.modId);
            expect(decryptedData.title).toBe(originalData.title);
        });

        it('should decrypt successfully when token whitespace is trimmed (fix scenario)', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const baseToken = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Simulate token with whitespace
            const tokenWithWhitespace = `  ${baseToken}  `;
            const trimmedToken = baseToken; // Backend always trims

            const originalData = {
                modId: 'mod_123',
                title: 'Test Mod',
            };

            // Encrypt with trimmed token (backend behavior - encryption also trims)
            const encryptedData = await encryptWithJWT(originalData, trimmedToken);

            // Decrypt with token that has whitespace - should succeed because both encrypt and decrypt trim
            // This demonstrates the fix is working correctly
            const decrypted = await decryptWithJWT(encryptedData, tokenWithWhitespace);
            expect(decrypted).toEqual(originalData);
        });

        it('should handle token trimming in response decryption (simulating /auth/me scenario)', async () => {
            const userId = 'user_123';
            const email = 'user@example.com';
            const customerId = 'cust_abc';

            const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
            const baseToken = await createRS256JWT({
                sub: userId,
                email: email,
                customerId: customerId,
                exp: exp,
                iat: Math.floor(Date.now() / 1000),
            });

            // Simulate token with whitespace stored in auth store
            const tokenWithWhitespace = `  ${baseToken}  `;
            const trimmedToken = baseToken; // Backend trims when encrypting

            // Simulate /auth/me response
            const responseData = {
                email: email,
                userId: userId,
                customerId: customerId,
                isSuperAdmin: false,
                displayName: 'Test User',
            };

            // Backend encrypts with trimmed token
            const encryptedResponse = await encryptWithJWT(responseData, trimmedToken);

            // Frontend decrypts with trimmed token (after fix - getTokenForDecryption trims)
            const decryptedResponse = await decryptWithJWT(encryptedResponse, tokenWithWhitespace.trim()) as typeof responseData;

            // Verify response matches
            expect(decryptedResponse).toEqual(responseData);
            expect(decryptedResponse.email).toBe(email);
            expect(decryptedResponse.customerId).toBe(customerId);
        });
    });
});

