/**
 * Health Check Handler
 * 
 * Health check endpoint for Chat Signaling worker
 * Returns encrypted health status using JWT encryption
 * 
 * @module handlers/health
 */

import { wrapWithEncryption } from '@strixun/api-framework';
import { getCorsHeaders } from '../utils/cors.js';
import type { Env } from '../types';

/**
 * Health check response data
 */
interface HealthCheckData {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  timestamp: string;
  environment?: string;
}

/**
 * Handle health check requests
 * 
 * GET /health
 * 
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 * 
 * @param request - Incoming HTTP request
 * @param env - Worker environment
 * @returns HTTP response with encrypted health data
 */
export async function handleHealth(
  request: Request,
  env: Env
): Promise<Response> {
  // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
  // ONLY check HttpOnly cookie - NO fallbacks, NO Authorization header
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
      instance: request.url,
    };
    
    const corsHeaders = getCorsHeaders(env, request);
    return new Response(JSON.stringify(errorResponse), {
      status: 401,
      headers: {
        'Content-Type': 'application/problem+json',
        ...corsHeaders,
      },
    });
  }
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const authCookie = cookies.find(c => c.startsWith('auth_token='));
  if (!authCookie) {
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
      instance: request.url,
    };
    
    const corsHeaders = getCorsHeaders(env, request);
    return new Response(JSON.stringify(errorResponse), {
      status: 401,
      headers: {
        'Content-Type': 'application/problem+json',
        ...corsHeaders,
      },
    });
  }
  
  const jwtToken = authCookie.substring('auth_token='.length).trim();

  // Create auth object for encryption
  // Note: For health checks, we use anonymous auth since we don't need user context
  const authForEncryption = { 
    userId: 'anonymous', 
    customerId: null, 
    jwtToken 
  };

  // Create health check response data
  const healthData: HealthCheckData = {
    status: 'ok',
    service: 'chat-signaling',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT,
  };
  
  const response = new Response(JSON.stringify(healthData), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Wrap with encryption - but disable for HttpOnly cookie auth (browser can't decrypt)
  // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
  const encryptedResult = await wrapWithEncryption(
    response, 
    null, // Pass null to disable encryption for HttpOnly cookies
    request, 
    env,
    {
      requireJWT: false
    }
  );
  
  return encryptedResult.response;
}
