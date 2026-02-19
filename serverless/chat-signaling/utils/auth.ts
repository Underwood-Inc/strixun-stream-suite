/**
 * Authentication Utilities
 * 
 * JWT authentication for Chat Signaling worker.
 * RS256 via JWKS only (OIDC).
 * @module utils/auth
 */

import { extractAuth } from '@strixun/api-framework';
import type { Env, AuthResult } from '../types';

/**
 * Authenticate request using JWT (RS256 via JWKS).
 * Extracts token from HttpOnly cookie or Authorization header.
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult> {
  try {
    const auth = await extractAuth(request, env as any);

    if (!auth) {
      return {
        authenticated: false,
        status: 401,
        error: 'Authentication required',
      };
    }

    const customerId = auth.customerId;
    return {
      authenticated: true,
      userId: customerId,
      customerId,
      jwtToken: auth.jwtToken,
    };
  } catch (error) {
    console.error('[Chat Signaling Auth] JWT verification error:', error);
    return {
      authenticated: false,
      status: 401,
      error: 'Token verification failed',
    };
  }
}
