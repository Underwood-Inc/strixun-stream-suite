/**
 * Authentication utilities for Streamkit API
 * 
 * Provides JWT verification and customer extraction from request
 */

import { verifyJWT, getJWTSecret } from '@strixun/api-framework';
import type { Env } from '../src/env.d.js';

/**
 * Extract and verify customer ID from JWT token in request
 * 
 * Checks both HttpOnly cookie (primary) and Authorization header (fallback for service-to-service)
 * 
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Customer ID
 * @throws Error if authentication fails
 */
export async function extractCustomerFromJWT(request: Request, env: Env): Promise<string> {
  let token: string | null = null;
  
  // PRIORITY 1: Check HttpOnly cookie first (primary - browser SSO)
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
  
  if (!token) {
    throw new Error('Authentication required. Please provide auth_token cookie or Authorization header.');
  }
  
  // Verify JWT token
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);
  
  if (!payload) {
    throw new Error('Invalid or expired token');
  }
  
  // Extract customer ID from payload (supports multiple field names)
  const customerId = payload.customerId || payload.userId || payload.sub;
  
  if (!customerId) {
    throw new Error('Token payload missing customer ID');
  }
  
  return customerId;
}
