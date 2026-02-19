/**
 * Authentication utilities
 * JWT verification for customer API endpoints
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret)
 */

import { extractAuth } from '@strixun/api-framework';
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

interface Env {
    JWT_SECRET?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    [key: string]: any;
}

interface AuthResult {
    customerId: string | null;
    jwtToken: string;
}

export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
    return verifyJWTShared(token, secret);
}

/**
 * Authenticate request and extract customer info.
 * Supports BOTH HttpOnly cookies (browser) and Authorization header (service-to-service).
 * Verifies RS256 tokens via JWKS when JWT_ISSUER is configured, with HS256 fallback.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const auth = await extractAuth(request, env, verifyJWTShared);
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

