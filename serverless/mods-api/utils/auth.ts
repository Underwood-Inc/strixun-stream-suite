/**
 * Authentication utilities
 * JWT verification for mods API endpoints.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Authenticate request and extract customer info.
 * Verifies RS256 tokens via JWKS.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const auth = await extractAuth(request, env as any);
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
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    AUTH_API_URL?: string;
    [key: string]: any;
}
