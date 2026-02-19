/**
 * Asymmetric JWT Utilities for OIDC Provider
 *
 * RS256 (RSASSA-PKCS1-v1_5 + SHA-256) signing and verification
 * using the Web Crypto API (Cloudflare Workers compatible).
 *
 * The private signing key is stored as a JWK JSON string in
 * the CF secret `OIDC_SIGNING_KEY`. The public key for JWKS
 * is derived by stripping private components from that JWK.
 */

export interface RSAPrivateJWK {
    kty: 'RSA';
    kid?: string;
    use?: string;
    alg?: string;
    n: string;
    e: string;
    d: string;
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
}

export interface RSAPublicJWK {
    kty: 'RSA';
    kid: string;
    use: string;
    alg: string;
    n: string;
    e: string;
}

export interface JWKSet {
    keys: RSAPublicJWK[];
}

export interface OIDCSigningContext {
    privateKey: CryptoKey;
    publicJwk: RSAPublicJWK;
    kid: string;
}

interface OIDCEnv {
    OIDC_SIGNING_KEY?: string;
    [key: string]: any;
}

const RS256_ALGORITHM: RsaHashedImportParams = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
};

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/**
 * Derive the public JWK from a private JWK by stripping private components.
 * Assigns a `kid` using the first 8 chars of a SHA-256 thumbprint (RFC 7638).
 */
export async function toPublicJwk(privateJwk: RSAPrivateJWK): Promise<RSAPublicJWK> {
    const kid = privateJwk.kid ?? await computeJwkThumbprint(privateJwk);

    return {
        kty: 'RSA',
        kid,
        use: 'sig',
        alg: 'RS256',
        n: privateJwk.n,
        e: privateJwk.e,
    };
}

/**
 * Compute a JWK thumbprint (RFC 7638) truncated to 8 hex chars.
 * Deterministic identifier derived from the key material itself.
 */
async function computeJwkThumbprint(jwk: RSAPrivateJWK): Promise<string> {
    const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return base64urlEncode(digest).substring(0, 8);
}

/**
 * Parse the OIDC signing key from environment and prepare a signing context.
 * Caches the imported CryptoKey for the lifetime of the worker isolate.
 */
let _cachedContext: OIDCSigningContext | null = null;

export async function getSigningContext(env: OIDCEnv): Promise<OIDCSigningContext> {
    if (_cachedContext) return _cachedContext;

    if (!env.OIDC_SIGNING_KEY) {
        throw new Error(
            'OIDC_SIGNING_KEY secret is not set. Generate one with:\n' +
            '  node -e "crypto.subtle.generateKey({name:\'RSASSA-PKCS1-v1_5\',modulusLength:2048,' +
            'publicExponent:new Uint8Array([1,0,1]),hash:\'SHA-256\'},true,[\'sign\',\'verify\'])' +
            '.then(k=>crypto.subtle.exportKey(\'jwk\',k.privateKey)).then(j=>console.log(JSON.stringify(j)))"\n' +
            '  wrangler secret put OIDC_SIGNING_KEY'
        );
    }

    let privateJwk: RSAPrivateJWK;
    try {
        privateJwk = JSON.parse(env.OIDC_SIGNING_KEY);
    } catch {
        throw new Error('OIDC_SIGNING_KEY is not valid JSON. Store the full RSA private JWK.');
    }

    if (privateJwk.kty !== 'RSA' || !privateJwk.d) {
        throw new Error('OIDC_SIGNING_KEY must be an RSA private JWK (kty=RSA with "d" component).');
    }

    const publicJwk = await toPublicJwk(privateJwk);

    const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateJwk as JsonWebKey,
        RS256_ALGORITHM,
        false,
        ['sign'],
    );

    _cachedContext = { privateKey, publicJwk, kid: publicJwk.kid };
    return _cachedContext;
}

/**
 * Sign an arbitrary JWT payload with RS256.
 * Returns the compact serialisation (header.payload.signature).
 */
export async function signJWT(
    payload: Record<string, unknown>,
    ctx: OIDCSigningContext,
): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT', kid: ctx.kid };
    const encoder = new TextEncoder();

    const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
    const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = await crypto.subtle.sign(
        RS256_ALGORITHM.name,
        ctx.privateKey,
        encoder.encode(signingInput),
    );

    return `${signingInput}.${base64urlEncode(signature)}`;
}

/**
 * Verify an RS256-signed JWT using a CryptoKey (public).
 * Returns the decoded payload or null on any failure.
 */
export async function verifyAsymmetricJWT(
    token: string,
    publicKey: CryptoKey,
): Promise<Record<string, unknown> | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;
        const signingInput = `${headerB64}.${payloadB64}`;

        const isValid = await crypto.subtle.verify(
            RS256_ALGORITHM.name,
            publicKey,
            base64urlDecode(signatureB64),
            new TextEncoder().encode(signingInput),
        );
        if (!isValid) return null;

        const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}

/**
 * Import a public JWK as a CryptoKey suitable for verification.
 */
export async function importPublicKey(jwk: RSAPublicJWK): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'jwk',
        jwk as JsonWebKey,
        RS256_ALGORITHM,
        false,
        ['verify'],
    );
}

/**
 * Compute `at_hash` or `c_hash` per OIDC Core 1.0 Section 3.3.2.11.
 * Takes the left-most half of the SHA-256 hash of the ASCII octets of the value.
 */
export async function computeHashClaim(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    const halfLength = new Uint8Array(digest).length / 2;
    return base64urlEncode(new Uint8Array(digest).slice(0, halfLength));
}

/**
 * Reset the cached signing context (useful for testing).
 */
export function resetSigningContext(): void {
    _cachedContext = null;
}
