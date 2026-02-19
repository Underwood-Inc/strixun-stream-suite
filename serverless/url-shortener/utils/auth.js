/**
 * Authentication Utilities
 * 
 * JWT authentication for URL Shortener worker.
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret).
 */

import { extractAuth } from '@strixun/api-framework';
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

export async function verifyJWT(token, secret) {
  return verifyJWTShared(token, secret);
}

export function getJWTSecret(env) {
  return getJWTSecretShared(env);
}

/**
 * Authenticate request using JWT (RS256 via JWKS, then HS256 fallback).
 * Extracts token from HttpOnly cookie or Authorization header.
 */
export async function authenticateRequest(request, env) {
  try {
    const auth = await extractAuth(request, env, verifyJWTShared);

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

