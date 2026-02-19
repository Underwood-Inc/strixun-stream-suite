/**
 * Authentication Utilities
 * 
 * JWT authentication for URL Shortener worker.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Authenticate request using JWT (RS256 via JWKS).
 * Extracts token from HttpOnly cookie or Authorization header.
 */
export async function authenticateRequest(request, env) {
  try {
    const auth = await extractAuth(request, env);

    if (!auth) {
      return { authenticated: false, status: 401, error: 'Authentication required' };
    }

    return {
      authenticated: true,
      userId: auth.customerId,
      customerId: auth.customerId,
      jwtToken: auth.jwtToken,
    };
  } catch (error) {
    console.error('[URL Shortener Auth] JWT verification error:', error);
    return { authenticated: false, status: 401, error: 'Token verification failed' };
  }
}
