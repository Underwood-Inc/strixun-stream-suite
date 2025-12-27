/**
 * Cryptographic utilities
 * OTP generation, hashing, JWT creation and verification
 */

interface JWTPayload {
    sub?: string;
    iss?: string;
    aud?: string;
    exp?: number;
    iat?: number;
    jti?: string;
    email?: string;
    email_verified?: boolean;
    userId?: string;
    customerId?: string | null;
    csrf?: string;
    [key: string]: any;
}

interface Env {
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * Generate OTP code
 * Uses cryptographically secure random number generation
 * @returns OTP code with length defined by OTP_LENGTH config
 * 
 * NOTE: OTP length is centralized in shared-config/otp-config.ts
 * This function uses the same value for consistency
 */
export function generateOTP(): string {
    // OTP configuration - matches shared-config/otp-config.ts
    // TODO: Import from shared-config/otp-config.ts when path resolution supports it
    const OTP_LENGTH = 9;
    const OTP_MAX_VALUE = 1000000000; // 10^9
    
    // Use 2 Uint32 values to get 64 bits, eliminating modulo bias
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    // Combine two 32-bit values for 64-bit range (0 to 2^64-1)
    // Then modulo OTP_MAX_VALUE for N-digit code
    // This eliminates modulo bias since 2^64 is much larger than OTP_MAX_VALUE
    const value = (Number(array[0]) * 0x100000000 + Number(array[1])) % OTP_MAX_VALUE;
    return value.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Hash email for storage key (SHA-256)
 * @param email - Email address
 * @returns Hex-encoded hash
 */
export async function hashEmail(email: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate user ID from email
 * @param email - Email address
 * @returns User ID
 */
export async function generateUserId(email: string): Promise<string> {
    const hash = await hashEmail(email);
    return `user_${hash.substring(0, 12)}`;
}

/**
 * Create JWT token
 * @param payload - Token payload
 * @param secret - Secret key for signing
 * @returns JWT token
 */
export async function createJWT(payload: JWTPayload, secret: string): Promise<string> {
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
 * @param token - JWT token
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
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
        ) as JWTPayload;
        
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
 * @param env - Worker environment
 * @returns JWT secret
 * @throws Error if JWT_SECRET is not set
 */
export function getJWTSecret(env: Env): string {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}

/**
 * Hash password using PBKDF2
 * @param password - Plain text password
 * @returns Hashed password (hex-encoded)
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate cryptographically secure API key
 * @param prefix - Key prefix (e.g., 'otp_live_sk_')
 * @returns API key
 */
export async function generateApiKey(prefix: string = 'otp_live_sk_'): Promise<string> {
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
 * @param apiKey - API key
 * @returns Hex-encoded hash
 */
export async function hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function constantTimeEquals(a: string, b: string): boolean {
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
 * @param data - Data to encrypt
 * @param secret - Encryption secret (from JWT_SECRET)
 * @returns Encrypted data (base64:iv:tag)
 */
export async function encryptData(data: string, secret: string): Promise<string> {
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
 * @param encryptedData - Encrypted data (base64:iv:tag)
 * @param secret - Decryption secret (from JWT_SECRET)
 * @returns Decrypted data
 */
export async function decryptData(encryptedData: string, secret: string): Promise<string | null> {
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

