/**
 * Customer Preferences Handlers
 * Handles customer preferences endpoints
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../../utils/crypto.js';
import {
  getCustomerPreferences,
  updateCustomerPreferences,
  getDefaultPreferences,
  type CustomerPreferences,
} from '../../services/customer-preferences.js';
import { ensureCustomerAccount } from '../auth/customer-creation.js';

interface Env {
  OTP_AUTH_KV: KVNamespace;
  JWT_SECRET?: string;
  [key: string]: any;
}

/**
 * Get current customer preferences
 * GET /customer/me/preferences
 */
export async function handleGetPreferences(request: Request, env: Env): Promise<Response> {
  try {
    // ONLY check HttpOnly cookie - NO Authorization header fallback
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authCookie.substring('auth_token='.length).trim();
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const userId = payload.userId || payload.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID not found in token' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
    const emailLower = payload.email?.toLowerCase().trim();
    let resolvedCustomerId = payload.customerId || customerId || null;
    if (emailLower) {
      try {
        resolvedCustomerId = await ensureCustomerAccount(emailLower, resolvedCustomerId, env);
      } catch (error) {
        console.error(`[Preferences] Failed to ensure customer account for ${emailLower}:`, error);
        return new Response(JSON.stringify({ 
          error: 'Failed to verify customer account. Please try again.',
          detail: env.ENVIRONMENT === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        }), {
          status: 500,
          headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
      }
    }

    const preferences = await getCustomerPreferences(resolvedCustomerId, resolvedCustomerId, env);

    // Generate request ID for root config
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Response(
      JSON.stringify({
        id: requestId,
        customerId: resolvedCustomerId,
        ...preferences,
      }),
      {
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Failed to get preferences',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Update customer preferences
 * PUT /customer/me/preferences
 */
export async function handleUpdatePreferences(request: Request, env: Env): Promise<Response> {
  try {
    // ONLY check HttpOnly cookie - NO Authorization header fallback
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authCookie.substring('auth_token='.length).trim();
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const customerId = payload.customerId || payload.userId || payload.sub;
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Customer ID not found in token' }), {
        status: 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
    const emailLower = payload.email?.toLowerCase().trim();
    let resolvedCustomerId = payload.customerId || customerId || null;
    if (emailLower) {
      try {
        resolvedCustomerId = await ensureCustomerAccount(emailLower, resolvedCustomerId, env);
      } catch (error) {
        console.error(`[Preferences] Failed to ensure customer account for ${emailLower}:`, error);
        return new Response(JSON.stringify({ 
          error: 'Failed to verify customer account. Please try again.',
          detail: env.ENVIRONMENT === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        }), {
          status: 500,
          headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await request.json();
    const updates: Partial<CustomerPreferences> = {};

    // Validate and update emailVisibility
    if (body.emailVisibility !== undefined) {
      if (body.emailVisibility !== 'private' && body.emailVisibility !== 'public') {
        return new Response(
          JSON.stringify({
            error: 'Invalid emailVisibility',
            message: 'emailVisibility must be "private" or "public"',
          }),
          {
            status: 400,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
          }
        );
      }
      updates.emailVisibility = body.emailVisibility;
    }

    // Validate and update privacy settings
    if (body.privacy !== undefined) {
      updates.privacy = {
        showEmail: body.privacy.showEmail ?? false,
        showProfilePicture: body.privacy.showProfilePicture ?? true,
      };
    }

    // Note: displayName updates should go through the display name endpoint
    // to handle history tracking and monthly limits

    const updated = await updateCustomerPreferences(resolvedCustomerId, resolvedCustomerId, updates, env);

    // Generate request ID for root config
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Response(
      JSON.stringify({
        id: requestId,
        customerId: resolvedCustomerId,
        ...updated,
      }),
      {
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Failed to update preferences',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      }
    );
  }
}

