/**
 * Unified JWT Verification (OIDC-aware)
 *
 * Tries RS256 (OIDC) first, falls back to HS256 (legacy).
 * Every handler that reads `auth_token` should use this instead
 * of calling `verifyJWT` directly.
 *
 * @module utils/verify-token
 */

import { verifyJWT, getJWTSecret } from './crypto.js';
import {
    getSigningContext,
    verifyAsymmetricJWT,
    importPublicKey,
} from './asymmetric-jwt.js';

interface TokenEnv {
    JWT_SECRET?: string;
    OIDC_SIGNING_KEY?: string;
    [key: string]: any;
}

/**
 * Verify a JWT token using RS256 (OIDC) first, then HS256 (legacy).
 * @returns Decoded payload or null on any failure.
 */
export async function verifyTokenOIDC(
    token: string,
    env: TokenEnv,
): Promise<Record<string, any> | null> {
    // RS256 (OIDC) attempt
    try {
        const ctx = await getSigningContext(env);
        const pubKey = await importPublicKey(ctx.publicJwk);
        const payload = await verifyAsymmetricJWT(token, pubKey);
        if (payload) return payload;
    } catch {
        // RS256 unavailable or verification failed -- fall through
    }

    // HS256 (legacy) fallback
    try {
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        if (payload) return payload as Record<string, any>;
    } catch {
        // HS256 also failed
    }

    return null;
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
