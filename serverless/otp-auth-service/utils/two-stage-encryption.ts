/**
 * Two-Stage Encryption System
 * 
 * Provides double encryption for sensitive data where the owner controls access.
 * This works WITHIN the router's automatic JWT encryption (which encrypts all responses).
 * 
 * Architecture:
 * - Router Level: ALL responses automatically encrypted with REQUESTER's JWT (any logged-in user can decrypt)
 * - Field Level: Sensitive fields (like userId/email) are double-encrypted:
 *   - Stage 1: Encrypted with DATA OWNER's JWT (only owner can decrypt Stage 1)
 *   - Stage 2: Encrypted with request key (requires approved request to decrypt)
 * 
 * Flow:
 * 1. Handler double-encrypts sensitive field (userId/email) with owner's JWT + request key
 * 2. Handler returns response with double-encrypted field: { id, customerId, userId: { doubleEncrypted: true, ... } }
 * 3. Router automatically encrypts ENTIRE response with requester's JWT
 * 4. Client decrypts router encryption → gets response with double-encrypted userId
 * 5. To decrypt userId: Need BOTH owner's JWT + approved request key
 * 
 * IMPORTANT:
 * - Router encrypts everything with requester's JWT (automatic, handled by router)
 * - customerId is single-encrypted (router level) - any logged-in user can decrypt
 * - userId (email) is double-encrypted (field level) - requires owner approval
 * - Stage 1 uses DATA OWNER's JWT (the user whose email it is)
 * - Stage 2 uses request key (from approved request)
 * - Requesters need owner's JWT (provided by system) + approved request key to decrypt
 */

import { decryptWithJWT, encryptWithJWT } from './jwt-encryption.js';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Hash request key for verification
 */
async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from request key using PBKDF2
 */
async function deriveKeyFromRequestKey(requestKey: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(requestKey),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );

    return key;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Two-Stage Encrypted Data Structure
 */
export interface TwoStageEncryptedData {
    version: number;
    doubleEncrypted: boolean;
    stage1: {
        // Stage 1: Encrypted with user's JWT
        encrypted: boolean;
        algorithm: string;
        iv: string;
        salt: string;
        tokenHash: string;
        data: string; // Base64 encrypted data
    };
    stage2: {
        // Stage 2: Encrypted with request key
        encrypted: boolean;
        algorithm: string;
        iv: string;
        salt: string;
        keyHash: string; // Hash of request key for verification
        data: string; // Base64 encrypted data (contains stage1 encrypted data)
    };
    timestamp: string;
}

/**
 * Encrypt data with two-stage encryption
 * 
 * @param data - Data to encrypt
 * @param userToken - DATA OWNER's JWT token (for Stage 1) - ONLY the owner can decrypt Stage 1
 * @param requestKey - Request key (for Stage 2) - must be approved by owner
 * @returns Two-stage encrypted data
 */
export async function encryptTwoStage(
    data: unknown,
    userToken: string,
    requestKey: string
): Promise<TwoStageEncryptedData> {
    if (!userToken || userToken.length < 10) {
        throw new Error('Valid data owner JWT token is required for Stage 1 encryption');
    }

    if (!requestKey || requestKey.length < 16) {
        throw new Error('Valid request key is required for Stage 2 encryption');
    }

    // Stage 1: Encrypt with user's JWT
    const stage1Encrypted = await encryptWithJWT(data, userToken);

    // Stage 2: Encrypt Stage 1 result with request key
    const stage2Salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const stage2IV = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const stage2Key = await deriveKeyFromRequestKey(requestKey, stage2Salt);
    const stage2KeyHash = await hashKey(requestKey);

    // Encrypt Stage 1 encrypted data
    const encoder = new TextEncoder();
    const stage1DataStr = JSON.stringify(stage1Encrypted);
    const stage2Encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: stage2IV },
        stage2Key,
        encoder.encode(stage1DataStr)
    );

    return {
        version: 1,
        doubleEncrypted: true,
        stage1: {
            encrypted: true,
            algorithm: 'AES-GCM-256',
            iv: stage1Encrypted.iv,
            salt: stage1Encrypted.salt,
            tokenHash: stage1Encrypted.tokenHash,
            data: stage1Encrypted.data, // This is encrypted with user's JWT
        },
        stage2: {
            encrypted: true,
            algorithm: 'AES-GCM-256',
            iv: arrayBufferToBase64(stage2IV),
            salt: arrayBufferToBase64(stage2Salt),
            keyHash: stage2KeyHash,
            data: arrayBufferToBase64(stage2Encrypted), // This contains Stage 1 encrypted data
        },
        timestamp: new Date().toISOString(),
    };
}

/**
 * Decrypt two-stage encrypted data
 * 
 * @param encryptedData - Two-stage encrypted data
 * @param userToken - DATA OWNER's JWT token (for Stage 1 decryption) - MUST be the owner's token
 * @param requestKey - Request key (for Stage 2 decryption) - must be from approved request
 * @returns Decrypted data
 * 
 * IMPORTANT: userToken MUST be the DATA OWNER's JWT, not the requester's JWT.
 * The system provides the owner's JWT in the request context when decrypting for approved requesters.
 */
export async function decryptTwoStage(
    encryptedData: TwoStageEncryptedData,
    userToken: string,
    requestKey: string
): Promise<unknown> {
    if (!encryptedData.doubleEncrypted) {
        // Not double-encrypted, try single-stage decryption
        return await decryptWithJWT(encryptedData as any, userToken);
    }

    if (!userToken || userToken.length < 10) {
        throw new Error('Valid data owner JWT token is required for Stage 1 decryption');
    }

    if (!requestKey || requestKey.length < 16) {
        throw new Error('Valid request key is required for Stage 2 decryption');
    }

    // Verify request key hash matches
    const requestKeyHash = await hashKey(requestKey);
    if (encryptedData.stage2.keyHash !== requestKeyHash) {
        throw new Error(
            'Decryption failed - request key does not match. ' +
            'Only approved requesters with the correct request key can decrypt this data.'
        );
    }

    // Stage 2: Decrypt with request key
    const stage2Salt = base64ToArrayBuffer(encryptedData.stage2.salt);
    const stage2IV = base64ToArrayBuffer(encryptedData.stage2.iv);
    const stage2EncryptedData = base64ToArrayBuffer(encryptedData.stage2.data);
    const stage2Key = await deriveKeyFromRequestKey(requestKey, new Uint8Array(stage2Salt));

    const stage2Decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(stage2IV) },
        stage2Key,
        stage2EncryptedData
    );

    const decoder = new TextDecoder();
    const stage1EncryptedStr = decoder.decode(stage2Decrypted);
    const stage1Encrypted = JSON.parse(stage1EncryptedStr);

    // Stage 1: Decrypt with user's JWT
    const decrypted = await decryptWithJWT(stage1Encrypted, userToken);

    return decrypted;
}

/**
 * Generate a secure request key
 * 
 * @returns Random request key (base64 encoded)
 */
export function generateRequestKey(): string {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    return arrayBufferToBase64(keyBytes.buffer);
}

/**
 * Check if data is double-encrypted
 */
export function isDoubleEncrypted(data: unknown): boolean {
    return (
        typeof data === 'object' &&
        data !== null &&
        'doubleEncrypted' in data &&
        (data as any).doubleEncrypted === true
    );
}

