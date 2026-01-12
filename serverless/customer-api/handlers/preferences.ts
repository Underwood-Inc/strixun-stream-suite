/**
 * Customer Preferences Handlers
 * 
 * Handles customer preference operations (email visibility, display name history, etc.)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import {
  getCustomerPreferences,
  updateCustomerPreferences,
  updateDisplayName,
  canChangeDisplayName,
} from '../services/preferences.js';
import type { CustomerPreferences } from '@strixun/schemas/customer';

interface Env {
  CUSTOMER_KV: KVNamespace;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  [key: string]: any;
}

interface AuthResult {
  customerId: string | null;
  jwtToken: string;
  // SECURITY: Email is NEVER included - use getCustomerEmail() utility when needed
}

/**
 * Get customer preferences
 * GET /customer/:id/preferences
 */
export async function handleGetPreferences(
  request: Request,
  env: Env,
  auth: AuthResult,
  customerId: string
): Promise<Response> {
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
  });

  try {
    // Verify access (customers can only access their own preferences)
    if (customerId !== auth.customerId) {
      const rfcError = createError(request, 403, 'Forbidden', 'Access denied');
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    const preferences = await getCustomerPreferences(customerId, env);

    return new Response(JSON.stringify({
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...preferences,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    const rfcError = createError(
      request,
      500,
      'Internal Server Error',
      env.ENVIRONMENT === 'development' ? error.message : 'Failed to get preferences'
    );
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        'Content-Type': 'application/problem+json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  }
}

/**
 * Update customer preferences
 * PUT /customer/:id/preferences
 */
export async function handleUpdatePreferences(
  request: Request,
  env: Env,
  auth: AuthResult,
  customerId: string
): Promise<Response> {
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
  });

  try {
    // Verify access (customers can only update their own preferences)
    if (customerId !== auth.customerId) {
      const rfcError = createError(request, 403, 'Forbidden', 'Access denied');
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    const body = await request.json() as Partial<CustomerPreferences>;
    
    const updated = await updateCustomerPreferences(customerId, body, env);

    return new Response(JSON.stringify({
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...updated,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  } catch (error: any) {
    console.error('Update preferences error:', error);
    const rfcError = createError(
      request,
      500,
      'Internal Server Error',
      env.ENVIRONMENT === 'development' ? error.message : 'Failed to update preferences'
    );
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        'Content-Type': 'application/problem+json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  }
}

/**
 * Update customer display name
 * PUT /customer/:id/display-name
 */
export async function handleUpdateDisplayName(
  request: Request,
  env: Env,
  auth: AuthResult,
  customerId: string
): Promise<Response> {
  const corsHeaders = createCORSHeaders(request, {
    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
  });

  try {
    // Verify access (customers can only update their own display name)
    if (customerId !== auth.customerId) {
      const rfcError = createError(request, 403, 'Forbidden', 'Access denied');
      return new Response(JSON.stringify(rfcError), {
        status: 403,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    const body = await request.json() as { displayName: string };
    
    if (!body.displayName || typeof body.displayName !== 'string') {
      const rfcError = createError(request, 400, 'Bad Request', 'Display name is required');
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    // Check monthly change limit
    const canChange = await canChangeDisplayName(customerId, env);
    if (!canChange.allowed) {
      const rfcError = createError(
        request,
        429,
        'Display Name Change Limit Exceeded',
        canChange.reason || 'Display name change limit exceeded'
      );
      return new Response(JSON.stringify(rfcError), {
        status: 429,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    const result = await updateDisplayName(customerId, body.displayName, 'user-changed', env);
    
    if (!result.success) {
      const rfcError = createError(request, 400, 'Update Failed', result.error || 'Failed to update display name');
      return new Response(JSON.stringify(rfcError), {
        status: 400,
        headers: {
          'Content-Type': 'application/problem+json',
          ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      displayName: body.displayName,
      message: 'Display name updated successfully',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  } catch (error: any) {
    console.error('Update display name error:', error);
    const rfcError = createError(
      request,
      500,
      'Internal Server Error',
      env.ENVIRONMENT === 'development' ? error.message : 'Failed to update display name'
    );
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        'Content-Type': 'application/problem+json',
        ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
      },
    });
  }
}
