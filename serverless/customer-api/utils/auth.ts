/**
 * Authentication utilities
 * JWT verification for customer API endpoints.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';

interface Env {
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    [key: string]: any;
}

interface AuthResult {
    customerId: string | null;
    jwtToken: string;
}

/**
 * Authenticate request and extract customer info.
 * Reads auth_token HttpOnly cookie or Authorization Bearer header,
 * then verifies RS256 via JWKS.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const auth = await extractAuth(request, env);
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
