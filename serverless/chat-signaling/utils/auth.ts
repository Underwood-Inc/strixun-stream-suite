/**
 * Authentication Utilities
 * 
 * JWT authentication for Chat Signaling worker.
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret).
 * @module utils/auth
 */

import { extractAuth } from '@strixun/api-framework';
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';
import type { Env, AuthResult, JWTPayload } from '../types';

export function getJWTSecret(env: Env): string {
  return getJWTSecretShared(env);
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  return verifyJWTShared(token, secret) as Promise<JWTPayload | null>;
}

/**
 * Authenticate request using JWT token (RS256 via JWKS, then HS256 fallback).
 * Extracts JWT from HttpOnly cookie or Authorization header.
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult> {
  try {
    const auth = await extractAuth(request, env as any, verifyJWTShared);

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
