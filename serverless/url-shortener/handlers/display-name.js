/**
 * Display Name Handler
 * 
 * Fetches customer display name using the same mechanism as other services
 * Uses customer API as the source of truth for display names
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';

/**
 * Get user display name
 * GET /api/display-name
 * 
 * Fetches display name from customer API using customerId from JWT token
 * This uses the same mechanism as mods-api and other services
 */
export async function handleGetDisplayName(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
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
    let displayName = null;
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
