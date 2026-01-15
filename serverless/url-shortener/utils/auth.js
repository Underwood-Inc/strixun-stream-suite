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
 * Authenticate request using OTP auth JWT tokens from HttpOnly cookie
 * CRITICAL: ONLY checks HttpOnly cookie - NO Authorization header fallback
 */
export async function authenticateRequest(request, env) {
  let token = null;
  
  // PRIORITY 1: Check HttpOnly cookie (browser requests)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    
    if (authCookie) {
      token = authCookie.substring('auth_token='.length).trim();
    }
  }
  
  // PRIORITY 2: Check Authorization header (service-to-service calls)
  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring('Bearer '.length).trim();
    }
  }
  
  // No authentication provided
  if (!token) {
    return { authenticated: false, status: 401, error: 'Authentication required' };
  }

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
    jwtToken: token, // Include token for encryption
  };
}

