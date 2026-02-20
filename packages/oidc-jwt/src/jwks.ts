/**
 * JWKS-based verification for resource servers.
 *
 * Fetches public keys from {JWT_ISSUER}/.well-known/jwks.json
 * and verifies tokens using the same logic as the auth service.
 */

import type { RSAPublicJWK } from './asymmetric.js';
import { verifyAsymmetricJWT, importPublicKey } from './asymmetric.js';

export interface JWKSEnv {
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    /** Optional: use this instead of global fetch (e.g. Service Binding) to avoid same-zone 522. */
    JWKS_FETCH?: (url: string) => Promise<Response>;
    [key: string]: any;
}

let _jwksCache: { keys: RSAPublicJWK[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 600_000; // 10 minutes

/**
 * Decode JWT header without verification (for kid extraction).
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

async function fetchJWKS(env: JWKSEnv): Promise<RSAPublicJWK[]> {
    if (_jwksCache && Date.now() - _jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
        return _jwksCache.keys;
    }
    const raw = env.JWT_ISSUER || env.AUTH_SERVICE_URL;
    if (!raw) {
        console.warn('[JWKS] No JWT_ISSUER or AUTH_SERVICE_URL in env');
        return [];
    }
    const issuer = raw.replace(/\/+$/, '');
    const jwksUrl = `${issuer}/.well-known/jwks.json`;
    const fetcher = typeof env.JWKS_FETCH === 'function' ? env.JWKS_FETCH : fetch;
    try {
        const res = await fetcher(jwksUrl);
        if (!res.ok) {
            console.warn('[JWKS] Fetch failed:', { url: jwksUrl, status: res.status });
            return _jwksCache?.keys ?? [];
        }
        const data = (await res.json()) as { keys: RSAPublicJWK[] };
        _jwksCache = { keys: data.keys, fetchedAt: Date.now() };
        return data.keys;
    } catch (err) {
        console.warn('[JWKS] Fetch error:', { url: jwksUrl, err: String(err) });
        return _jwksCache?.keys ?? [];
    }
}

/**
 * Verify JWT using JWKS (for resource servers).
 * Same verification algorithm as auth service; key source is JWKS fetch.
 */
export async function verifyWithJWKS(
    token: string,
    env: JWKSEnv,
): Promise<Record<string, unknown> | null> {
    const header = decodeJWTHeader(token);
    if (!header || header.alg !== 'RS256') return null;

    const keys = await fetchJWKS(env);
    const matchingKey = header.kid
        ? keys.find(k => k.kid === header.kid)
        : keys[0];
    if (!matchingKey) return null;

    const publicKey = await importPublicKey(matchingKey);
    return verifyAsymmetricJWT(token, publicKey);
}
