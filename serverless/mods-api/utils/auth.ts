/**
 * Authentication utilities
 * RS256 via JWKS (OIDC) -- verifies JWTs locally using public keys from the
 * auth service's /.well-known/jwks.json endpoint (cached 10 min).
 * No server-to-server /auth/me call required.
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Decode the payload of an already-verified JWT (no signature check).
 * Safe to call only AFTER the token has been verified by extractAuth/JWKS.
 */
function decodeVerifiedPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
    } catch {
        return null;
    }
}

/**
 * Authenticate request using RS256 JWKS verification.
 * Extracts token from HttpOnly cookie or Authorization Bearer header,
 * verifies signature via JWKS, and reads claims from the verified payload.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const auth = await extractAuth(request, env);
        if (!auth) return null;

        const payload = auth.jwtToken ? decodeVerifiedPayload(auth.jwtToken) : null;

        return {
            customerId: auth.customerId,
            jwtToken: auth.jwtToken ?? '',
            isSuperAdmin: (payload?.isSuperAdmin as boolean) ?? false,
        };
    } catch (error) {
        console.error('[ModsAPI Auth] JWKS verification error:', error);
        return null;
    }
}

export type { JWTPayload } from '@strixun/api-framework/jwt';

export interface AuthResult {
    customerId: string;
    jwtToken: string;
    isSuperAdmin: boolean;
}

interface Env {
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    AUTH_API_URL?: string;
    [key: string]: any;
}
