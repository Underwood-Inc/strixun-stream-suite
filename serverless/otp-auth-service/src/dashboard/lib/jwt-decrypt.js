/**
 * JWT Token-Based Decryption for Dashboard Data
 *
 * Decrypts encrypted dashboard responses using JWT token
 * Matches the server-side encryption pattern
 */
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
/**
 * Hash JWT token for verification
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
 */
async function deriveKeyFromToken(token, salt) {
    const encoder = new TextEncoder();
    const tokenKey = await crypto.subtle.importKey('raw', encoder.encode(token), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    const key = await crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
    }, tokenKey, { name: 'AES-GCM', length: KEY_LENGTH }, false, ['encrypt', 'decrypt']);
    return key;
}
/**
 * Convert base64 to ArrayBuffer
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
 * Decrypt data using JWT token
 */
export async function decryptWithJWT(encryptedData, token) {
    if (!encryptedData.encrypted) {
        // Not encrypted, return as-is (backward compatibility)
        return encryptedData;
    }
    if (!token || token.length < 10) {
        throw new Error('Valid JWT token is required for decryption');
    }
    // Extract metadata as ArrayBuffer
    const saltBuffer = base64ToArrayBuffer(encryptedData.salt || '');
    const ivBuffer = base64ToArrayBuffer(encryptedData.iv);
    const encryptedDataBuffer = base64ToArrayBuffer(encryptedData.data);
    // Verify token hash matches
    if (encryptedData.tokenHash) {
        const tokenHash = await hashToken(token);
        if (encryptedData.tokenHash !== tokenHash) {
            throw new Error('Decryption failed - token does not match. ' +
                'Only authenticated users (with email OTP access) can decrypt this data.');
        }
    }
    // Derive key from token
    const key = await deriveKeyFromToken(token, saltBuffer);
    // Decrypt
    try {
        const iv = new Uint8Array(ivBuffer);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, encryptedDataBuffer);
        const decoder = new TextDecoder();
        const dataStr = decoder.decode(decrypted);
        return JSON.parse(dataStr);
    }
    catch (error) {
        throw new Error('Decryption failed - incorrect token or corrupted data. ' +
            'Only authenticated users (with email OTP access) can decrypt this data.');
    }
}
//# sourceMappingURL=jwt-decrypt.js.map