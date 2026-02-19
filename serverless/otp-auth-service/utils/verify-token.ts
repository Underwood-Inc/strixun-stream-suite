/**
 * Unified JWT Verification (OIDC)
 *
 * RS256 only -- verifies via the local OIDC_SIGNING_KEY public key.
 * Every handler that reads `auth_token` should use this instead
 * of calling `verifyJWT` directly.
 *
 * @module utils/verify-token
 */

import {
    getSigningContext,
    verifyAsymmetricJWT,
    importPublicKey,
} from './asymmetric-jwt.js';

interface TokenEnv {
    OIDC_SIGNING_KEY?: string;
    [key: string]: any;
}

/**
 * Verify a JWT token using RS256 (OIDC).
 * @returns Decoded payload or null on any failure.
 */
export async function verifyTokenOIDC(
    token: string,
    env: TokenEnv,
): Promise<Record<string, any> | null> {
    try {
        const ctx = await getSigningContext(env);
        const pubKey = await importPublicKey(ctx.publicJwk);
        const payload = await verifyAsymmetricJWT(token, pubKey);
        return payload ?? null;
    } catch {
        return null;
    }
}

/**
 * Extract the raw `auth_token` value from a Cookie header string.
 * @returns The trimmed token string, or null if not present.
 */
export function extractAuthToken(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) return null;
    return authCookie.substring('auth_token='.length).trim();
}
