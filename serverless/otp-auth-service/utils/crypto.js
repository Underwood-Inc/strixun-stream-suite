/**
 * Cryptographic utilities
 * OTP generation, hashing, JWT creation and verification
 */

/**
 * Generate 6-digit OTP code
 * Uses cryptographically secure random number generation
 * @returns {string} 6-digit OTP code
 */
export function generateOTP() {
    // Use 2 Uint32 values to get 64 bits, eliminating modulo bias
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    // Combine two 32-bit values for 64-bit range (0 to 2^64-1)
    // Then modulo 1,000,000 for 6-digit code
    // This eliminates modulo bias since 2^64 is much larger than 1,000,000
    const value = (Number(array[0]) * 0x100000000 + Number(array[1])) % 1000000;
    return value.toString().padStart(6, '0');
}

/**
 * Hash email for storage key (SHA-256)
 * @param {string} email - Email address
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate user ID from email
 * @param {string} email - Email address
 * @returns {Promise<string>} User ID
 */
export async function generateUserId(email) {
    const hash = await hashEmail(email);
    return `user_${hash.substring(0, 12)}`;
}

/**
 * Create JWT token
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} JWT token
 */
export async function createJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/_/g, '/');
    
    return `${signatureInput}.${signatureB64}`;
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for verification
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
export async function verifyJWT(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [headerB64, payloadB64, signatureB64] = parts;
        
        // Verify signature
        const encoder = new TextEncoder();
        const signatureInput = `${headerB64}.${payloadB64}`;
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // Decode signature
        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(signatureInput)
        );
        
        if (!isValid) return null;
        
        // Decode payload
        const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
        );
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Get JWT secret from environment
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 * @throws {Error} If JWT_SECRET is not set
 */
export function getJWTSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}

/**
 * Hash password using PBKDF2
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password (hex-encoded)
 */
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate cryptographically secure API key
 * @param {string} prefix - Key prefix (e.g., 'otp_live_sk_')
 * @returns {Promise<string>} API key
 */
export async function generateApiKey(prefix = 'otp_live_sk_') {
    // Generate 32 random bytes (256 bits)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    
    // Convert to base64url (URL-safe base64)
    const base64 = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return `${prefix}${base64}`;
}

/**
 * Hash API key for storage (SHA-256)
 * @param {string} apiKey - API key
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashApiKey(apiKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
export function constantTimeEquals(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

/**
 * Encrypt data using AES-GCM
 * @param {string} data - Data to encrypt
 * @param {string} secret - Encryption secret (from JWT_SECRET)
 * @returns {Promise<string>} Encrypted data (base64:iv:tag)
 */
export async function encryptData(data, secret) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    // Derive key from secret using SHA-256
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
    const key = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBytes
    );
    
    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);
    
    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 * @param {string} encryptedData - Encrypted data (base64:iv:tag)
 * @param {string} secret - Decryption secret (from JWT_SECRET)
 * @returns {Promise<string>} Decrypted data
 */
export async function decryptData(encryptedData, secret) {
    try {
        const encoder = new TextEncoder();
        
        // Decode base64
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        // Extract IV (first 12 bytes) and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        // Derive key from secret
        const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
        const key = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        
        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        
        // Convert to string
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        return null;
    }
}

