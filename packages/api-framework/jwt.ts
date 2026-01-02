/**
 * JWT Utilities
 * 
 * Shared JWT creation and verification utilities for all services.
 * Uses base64url encoding (RFC 7515) with proper padding handling.
 * 
 * This is the canonical implementation - all services should use this.
 */

/**
 * JWT Payload interface
 */
export interface JWTPayload {
    sub?: string; // User ID (required)
    iss?: string; // Issuer
    aud?: string; // Audience
    exp?: number; // Expiration time (Unix timestamp)
    iat?: number; // Issued at (Unix timestamp)
    jti?: string; // JWT ID
    email?: string;
    email_verified?: boolean;
    userId?: string;
    customerId?: string | null;
    csrf?: string;
    isSuperAdmin?: boolean;
    [key: string]: any;
}

/**
 * Create JWT token
 * Uses base64url encoding (RFC 7515) for all parts
 * 
 * @param payload - Token payload
 * @param secret - Secret key for signing
 * @returns JWT token string
 */
export async function createJWT(payload: JWTPayload, secret: string): Promise<string> {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encoder = new TextEncoder();
    
    // Encode header and payload as base64url (RFC 7515)
    // Base64url: replace + with -, / with _, and remove padding =
    const headerB64 = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    const payloadB64 = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    // Create signature input
    const signatureInput = `${headerB64}.${payloadB64}`;
    
    // Import key for signing
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Sign the signature input
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    
    // Encode signature as base64url (RFC 7515)
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    // Return complete JWT token
    return `${signatureInput}.${signatureB64}`;
}

/**
 * Verify JWT token
 * Handles base64url decoding with proper padding
 * 
 * @param token - JWT token string
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        
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
        
        // Decode signature (convert base64url to base64, add padding if needed)
        let signatureBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
        while (signatureBase64.length % 4) {
            signatureBase64 += '=';
        }
        const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
        
        // Verify signature
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(signatureInput)
        );
        
        if (!isValid) {
            return null;
        }
        
        // Decode payload (convert base64url to base64, add padding if needed)
        let payloadBase64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        while (payloadBase64.length % 4) {
            payloadBase64 += '=';
        }
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson) as JWTPayload;
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        // Silently fail on any error (invalid token format, JSON parse error, etc.)
        return null;
    }
}

/**
 * Get JWT secret from environment
 * 
 * @param env - Worker environment with JWT_SECRET
 * @returns JWT secret string
 * @throws Error if JWT_SECRET is not set
 */
export function getJWTSecret(env: { JWT_SECRET?: string; [key: string]: any }): string {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}
