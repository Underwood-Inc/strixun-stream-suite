/**
 * Display Name Handler
 * 
 * Fetches customer display name using the same mechanism as other services
 * Uses customer API as the source of truth for display names
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';

/**
 * Environment interface for display name handler
 */
interface Env {
  JWT_SECRET?: string;
  CUSTOMER_API_URL?: string;
  NETWORK_INTEGRITY_KEYPHRASE?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * Authentication result interface
 */
interface AuthResult {
  authenticated: boolean;
  customerId?: string;
  error?: string;
  status?: number;
  [key: string]: unknown;
}

/**
 * Get user display name
 * GET /api/display-name
 * 
 * Fetches display name from customer API using customerId from JWT token
 * This uses the same mechanism as mods-api and other services
 */
export async function handleGetDisplayName(request: Request, env: Env): Promise<Response> {
  try {
    // Authenticate user
    const auth: AuthResult = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Get customerId from auth
    const customerId = auth.customerId;
    
    if (!customerId) {
      console.warn('[DisplayName] No customerId in auth result:', auth);
      return new Response(JSON.stringify({ 
        error: 'Customer ID not found',
        detail: 'User token does not contain customerId'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Fetch displayName from customer data - customer is the source of truth
    // Use the same mechanism as mods-api and other services
    let displayName: string | null = null;
    try {
      const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
      displayName = await fetchDisplayNameByCustomerId(customerId, env);
      
      if (displayName) {
        console.log('[DisplayName] Fetched displayName from customer data:', { 
          displayName, 
          customerId 
        });
      } else {
        console.warn('[DisplayName] Could not fetch displayName from customer data:', {
          customerId
        });
      }
    } catch (error) {
      console.error('[DisplayName] Failed to fetch displayName from customer data:', {
        customerId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - return null displayName rather than failing the request
    }

    return new Response(JSON.stringify({
      success: true,
      displayName: displayName || null,
      customerId,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[DisplayName] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      error: 'Failed to get display name',
      message: errorMessage,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}
