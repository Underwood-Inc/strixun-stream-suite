/**
 * JWT Token-Based Encryption for Customer Data
 * 
 * Encrypts customer data end-to-end using JWT token as key derivation source
 * Only the JWT token holder can decrypt the data
 * 
 * Uses AES-GCM-256 encryption with PBKDF2 key derivation
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Hash JWT token for verification
 */
async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from JWT token using PBKDF2
 */
async function deriveKeyFromToken(token: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const tokenKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(token),
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
        tokenKey,
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
 * Encrypt data with JWT token
 */
export async function encryptWithJWT(data: unknown, token: string): Promise<any> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKeyFromToken(token, salt);
    const tokenHash = await hashToken(token);

    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(dataStr)
    );

    return {
        version: 3,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: arrayBufferToBase64(iv.buffer),
        salt: arrayBufferToBase64(salt.buffer),
        tokenHash: tokenHash,
        data: arrayBufferToBase64(encrypted),
    };
}

/**
 * Decrypt data with JWT token
 */
export async function decryptWithJWT(encryptedData: any, token: string): Promise<unknown> {
    if (!encryptedData.encrypted) {
        return encryptedData;
    }

    const tokenHash = await hashToken(token);
    if (encryptedData.tokenHash !== tokenHash) {
        throw new Error('Token hash mismatch - data was encrypted with a different token');
    }

    const salt = base64ToArrayBuffer(encryptedData.salt);
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const encrypted = base64ToArrayBuffer(encryptedData.data);

    const key = await deriveKeyFromToken(token, new Uint8Array(salt));
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        encrypted
    );

    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
}

