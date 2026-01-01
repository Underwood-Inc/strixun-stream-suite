/**
 * Authentication Utilities
 * 
 * JWT authentication for URL Shortener worker
 */

// Use shared JWT utilities from api-framework (canonical implementation)
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

/**
 * Verify JWT token (compatible with OTP auth service)
 * Uses shared implementation from api-framework
 */
export async function verifyJWT(token, secret) {
  return verifyJWTShared(token, secret);
}

/**
 * Get JWT secret from environment
 * Uses shared implementation from api-framework
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 * @throws {Error} If JWT_SECRET is not set
 */
export function getJWTSecret(env) {
  return getJWTSecretShared(env);
}

/**
 * Authenticate request using OTP auth JWT tokens
 */
export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, error: 'Authorization header required' };
  }

  const token = authHeader.substring(7);
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    // Support both old format (userId) and OIDC format (sub)
    userId: payload.userId || payload.sub,
    email: payload.email,
    customerId: payload.customerId || payload.aud || null,
  };
}

