/**
 * Authentication utilities
 * JWT verification for game API endpoints.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Authenticate request and extract user info.
 * Reads auth_token HttpOnly cookie or Authorization Bearer header,
 * then verifies RS256 via JWKS.
 */
export async function authenticateRequest(request, env) {
    try {
        const auth = await extractAuth(request, env);

        if (!auth || !auth.customerId) {
            return null;
        }

        return {
            userId: auth.customerId,
            customerId: auth.customerId,
            jwtToken: auth.jwtToken,
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}
