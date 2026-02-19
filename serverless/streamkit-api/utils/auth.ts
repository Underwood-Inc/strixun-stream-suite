/**
 * Authentication utilities for Streamkit API
 * 
 * Provides JWT verification and customer extraction from request.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';
import type { Env } from '../src/env.d.js';

/**
 * Extract and verify customer ID from JWT token in request.
 * Checks HttpOnly cookie (primary) and Authorization header (fallback).
 * Verifies RS256 via JWKS.
 *
 * @throws Error if authentication fails
 */
export async function extractCustomerFromJWT(request: Request, env: Env): Promise<string> {
  const auth = await extractAuth(request, env as any);

  if (!auth) {
    throw new Error('Authentication required. Please provide auth_token cookie or Authorization header.');
  }

  const customerId = auth.customerId;
  if (!customerId) {
    throw new Error('Token payload missing customer ID');
  }

  return customerId;
}
