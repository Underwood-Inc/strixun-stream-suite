/**
 * JWT Utilities — RS256 (OIDC) Only
 *
 * All JWT signing uses RS256 via the OIDC_SIGNING_KEY (see asymmetric-jwt.ts).
 * All JWT verification uses RS256 via JWKS (see route-protection.ts).
 *
 * HS256 functions have been removed. There is no shared-secret JWT path.
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
