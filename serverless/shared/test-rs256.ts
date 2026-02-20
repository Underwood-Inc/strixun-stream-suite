/**
 * RS256 test utilities
 * Generates ephemeral key pairs for integration tests that need
 * real RS256 JWT verification through the production code path.
 *
 * Usage:
 *   import { createRS256JWT, mockJWKSEndpoint } from '../../shared/test-rs256.js';
 *
 *   let cleanupJWKS: () => void;
 *   beforeAll(async () => { cleanupJWKS = await mockJWKSEndpoint(); });
 *   afterAll(() => cleanupJWKS());
 */

let _cachedKeyPair: CryptoKeyPair | null = null;
let _cachedPublicJWK: JsonWebKey | null = null;

const RS256_PARAMS: RsaHashedKeyGenParams = {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
};

export async function getTestKeyPair(): Promise<CryptoKeyPair> {
    if (_cachedKeyPair) return _cachedKeyPair;
    _cachedKeyPair = await crypto.subtle.generateKey(RS256_PARAMS, true, ['sign', 'verify']);
    return _cachedKeyPair;
}

export async function getTestPublicJWK(): Promise<JsonWebKey & { kid: string; use: string; alg: string }> {
    if (_cachedPublicJWK) return _cachedPublicJWK as any;
    const kp = await getTestKeyPair();
    const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    _cachedPublicJWK = { ...jwk, kid: 'test-kid-1', use: 'sig', alg: 'RS256' };
    return _cachedPublicJWK as any;
}

function base64url(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Create an RS256-signed JWT with the given payload.
 * The token will be verifiable by the mocked JWKS endpoint.
 */
export async function createRS256JWT(
    payload: Record<string, any>,
): Promise<string> {
    const kp = await getTestKeyPair();
    const publicJWK = await getTestPublicJWK();

    const header = { alg: 'RS256', typ: 'JWT', kid: publicJWK.kid };
    const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const sigInput = `${headerB64}.${payloadB64}`;

    const signature = await crypto.subtle.sign(
        RS256_PARAMS.name,
        kp.privateKey,
        new TextEncoder().encode(sigInput),
    );

    return `${sigInput}.${base64url(signature)}`;
}

/**
 * Installs a fetch mock that intercepts JWKS requests and returns
 * the test public key. Returns a cleanup function to restore fetch.
 */
export async function mockJWKSEndpoint(): Promise<() => void> {
    const publicJWK = await getTestPublicJWK();
    const jwksResponse = JSON.stringify({ keys: [publicJWK] });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/.well-known/jwks.json')) {
            return new Response(jwksResponse, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return originalFetch(input, init);
    }) as typeof fetch;

    return () => { globalThis.fetch = originalFetch; };
}
