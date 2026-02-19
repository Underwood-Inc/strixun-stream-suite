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
 * Covers standard JWT (RFC 7519), OAuth 2.0, and OIDC claims
 */
export interface JWTPayload {
    sub?: string;
    iss?: string;
    aud?: string | string[];
    exp?: number;
    iat?: number;
    jti?: string;
    email_verified?: boolean;
    customerId: string;
    scope?: string;
    client_id?: string | null;
    at_hash?: string;
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
 * @deprecated HS256 verification is no longer used for authentication.
 * All services verify JWTs via RS256 (OIDC/JWKS) using extractAuth().
 * Kept only for backward compatibility in test utilities.
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

// ---------------------------------------------------------------------------
// Asymmetric (RS256) verification for OIDC resource servers
// ---------------------------------------------------------------------------

/**
 * Public JWK structure for RS256 keys
 */
export interface RSAPublicJWK {
    kty: 'RSA';
    kid: string;
    use: string;
    alg: string;
    n: string;
    e: string;
}

const RS256_IMPORT_PARAMS: RsaHashedImportParams = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
};

/**
 * Verify an RS256-signed JWT using a public JWK.
 * Intended for resource servers that fetch keys from /.well-known/jwks.json
 * and verify ID Tokens or access tokens without a shared secret.
 *
 * @param token  - Compact JWT string
 * @param jwk    - RSA public JWK (from JWKS endpoint)
 * @returns Decoded payload or null if invalid / expired
 */
export async function verifyRS256JWT(token: string, jwk: RSAPublicJWK): Promise<JWTPayload | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;

        const publicKey = await crypto.subtle.importKey(
            'jwk',
            jwk as JsonWebKey,
            RS256_IMPORT_PARAMS,
            false,
            ['verify'],
        );

        let sigBase64 = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
        while (sigBase64.length % 4) sigBase64 += '=';
        const signature = Uint8Array.from(atob(sigBase64), c => c.charCodeAt(0));

        const encoder = new TextEncoder();
        const isValid = await crypto.subtle.verify(
            RS256_IMPORT_PARAMS.name,
            publicKey,
            signature,
            encoder.encode(`${headerB64}.${payloadB64}`),
        );
        if (!isValid) return null;

        let payloadBase64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        while (payloadBase64.length % 4) payloadBase64 += '=';
        const payload = JSON.parse(atob(payloadBase64)) as JWTPayload;

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}

/**
 * Decode a JWT header without verification to extract `kid` and `alg`.
 * Used to select the correct key from a JWKS before verification.
 */
export function decodeJWTHeader(token: string): { alg?: string; kid?: string; typ?: string } | null {
    try {
        const headerB64 = token.split('.')[0];
        if (!headerB64) return null;

        let base64 = headerB64.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';

        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}
