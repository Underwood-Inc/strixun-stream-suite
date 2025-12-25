/**
 * JWT Token-Based Encryption for Game Data
 * 
 * Encrypts all game data end-to-end using JWT token as key derivation source
 * Only the JWT token holder can decrypt the data
 * 
 * Uses the same pattern as the main app encryption system:
 * - AES-GCM-256 encryption
 * - PBKDF2 key derivation from JWT token
 * - Random salt and IV per encryption
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Hash JWT token for verification
 * @param {string} token - JWT token
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashToken(token) {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from JWT token using PBKDF2
 * @param {string} token - JWT token
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} Derived encryption key
 */
async function deriveKeyFromToken(token, salt) {
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
 * @param {ArrayBuffer} buffer - ArrayBuffer to convert
 * @returns {string} Base64 string
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Encrypt data using JWT token
 * @param {any} data - Data to encrypt
 * @param {string} token - JWT token from request
 * @returns {Promise<object>} Encrypted data blob
 */
export async function encryptWithJWT(data, token) {
    if (!token || token.length < 10) {
        throw new Error('Valid JWT token is required for encryption');
    }

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Derive key from token
    const key = await deriveKeyFromToken(token, salt);

    // Hash token for verification
    const tokenHash = await hashToken(token);

    // Encrypt data
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(dataStr)
    );

    // Return encrypted blob
    return {
        version: 3,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt),
        tokenHash: tokenHash,
        data: arrayBufferToBase64(encrypted),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Decrypt data using JWT token (for client-side use)
 * @param {object} encryptedData - Encrypted data blob
 * @param {string} token - JWT token
 * @returns {Promise<any>} Decrypted data
 */
export async function decryptWithJWT(encryptedData, token) {
    if (!encryptedData.encrypted) {
        // Not encrypted, return as-is (backward compatibility)
        return encryptedData;
    }

    if (!token || token.length < 10) {
        throw new Error('Valid JWT token is required for decryption');
    }

    // Extract metadata
    const salt = base64ToArrayBuffer(encryptedData.salt);
    const iv = base64ToArrayBuffer(encryptedData.iv);
    const encryptedDataBuffer = base64ToArrayBuffer(encryptedData.data);

    // Verify token hash matches
    if (encryptedData.tokenHash) {
        const tokenHash = await hashToken(token);
        if (encryptedData.tokenHash !== tokenHash) {
            throw new Error(
                'Decryption failed - token does not match. ' +
                'Only authenticated users (with email OTP access) can decrypt this data.'
            );
        }
    }

    // Derive key from token
    const key = await deriveKeyFromToken(token, new Uint8Array(salt));

    // Decrypt
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            encryptedDataBuffer
        );

        const decoder = new TextDecoder();
        const dataStr = decoder.decode(decrypted);
        return JSON.parse(dataStr);
    } catch (error) {
        throw new Error(
            'Decryption failed - incorrect token or corrupted data. ' +
            'Only authenticated users (with email OTP access) can decrypt this data.'
        );
    }
}

