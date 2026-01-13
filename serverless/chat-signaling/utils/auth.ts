/**
 * Authentication Utilities
 * 
 * JWT authentication for Chat Signaling worker using shared utilities
 * @module utils/auth
 */

import { verifyJWT as verifyJWTShared } from '@strixun/api-framework';
import type { Env, AuthResult, JWTPayload } from '../types';

/**
 * Get JWT secret from environment
 * 
 * CRITICAL: JWT_SECRET must be set via: wrangler secret put JWT_SECRET
 * IMPORTANT: Use the SAME secret as your main API worker (OTP auth service)
 * 
 * @param env - Worker environment
 * @returns JWT secret
 * @throws Error if JWT_SECRET is not set
 */
export function getJWTSecret(env: Env): string {
  if (!env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Set it via: wrangler secret put JWT_SECRET. ' +
      'IMPORTANT: Use the SAME secret as your main API worker.'
    );
  }
  return env.JWT_SECRET;
}

/**
 * Verify JWT token using shared utility
 * 
 * @param token - JWT token to verify
 * @param secret - JWT secret
 * @returns JWT payload if valid, null if invalid
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  return verifyJWTShared(token, secret) as Promise<JWTPayload | null>;
}

/**
 * Authenticate request using JWT token
 * 
 * Extracts JWT from Authorization header and validates it
 * 
 * @param request - Incoming request
 * @param env - Worker environment
 * @returns Authentication result with user info
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult> {
  let token: string | null = null;
  
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
    return { 
      authenticated: false, 
      status: 401, 
      error: 'Authentication required' 
    };
  }

  try {
    // Get JWT secret
    const jwtSecret = getJWTSecret(env);

    // Verify token
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return { 
        authenticated: false, 
        status: 401, 
        error: 'Invalid or expired token' 
      };
    }

    // Extract user information
    // CRITICAL: sub is the customerId (not userId - we don't have users)
    const customerId = payload.customerId || payload.sub;
    const userId = customerId; // Alias for compatibility
    const email = payload.email;

    return {
      authenticated: true,
      userId,
      customerId,
      email,
      jwtToken: token,
    };
  } catch (error) {
    console.error('[Chat Signaling Auth] JWT verification error:', error);
    return { 
      authenticated: false, 
      status: 401, 
      error: 'Token verification failed' 
    };
  }
}
