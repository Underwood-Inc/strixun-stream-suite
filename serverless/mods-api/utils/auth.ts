/**
 * Authentication utilities
 * Uses JWKS (OIDC) for verification - same path as api-framework route protection.
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Authenticate request via RS256 JWKS (OIDC).
 * Extracts token from cookie or Bearer header, verifies via {JWT_ISSUER}/.well-known/jwks.json.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    return extractAuth(request, env);
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
