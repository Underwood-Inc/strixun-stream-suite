/**
 * Authentication utilities
 * JWT verification for mods API endpoints.
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret).
 */

import { extractAuth } from '@strixun/api-framework';
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    const payload = await verifyJWTShared(token, secret);
    if (!payload) {
        console.log('[Auth] JWT signature verification failed - signature does not match');
    }
    return payload;
}

/**
 * Authenticate request and extract customer info.
 * Verifies RS256 tokens via JWKS when JWT_ISSUER is configured, with HS256 fallback.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const auth = await extractAuth(request, env as any, verifyJWTShared);
        if (!auth || !auth.customerId) {
            return null;
        }

        return {
            customerId: auth.customerId,
            jwtToken: auth.jwtToken || '',
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

export type { JWTPayload } from '@strixun/api-framework/jwt';

export interface AuthResult {
    customerId: string;
    jwtToken: string;
}

interface Env {
    JWT_SECRET?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    AUTH_API_URL?: string;
    [key: string]: any;
}

