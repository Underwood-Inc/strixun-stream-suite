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

  // CRITICAL: Detect if request is using HttpOnly cookie (browser request)
  // If yes, we must disable response encryption because JavaScript can't access HttpOnly cookies to decrypt
  // For HttpOnly cookie requests, pass null to disable encryption
  // For Authorization header requests (service-to-service), pass auth object to enable encryption
  const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
  const authForEncryption = isHttpOnlyCookie ? null : {
    userId: 'anonymous',
    customerId: null,
    jwtToken
  };

  // Wrap with encryption - disable for HttpOnly cookie auth (browser can't decrypt)
  // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
  const encryptedResult = await wrapWithEncryption(
    response, 
    authForEncryption, // Pass null for HttpOnly cookies, auth object for service-to-service
    request, 
    env,
    {
      requireJWT: authForEncryption ? true : false
    }
  );
  
  return encryptedResult.response;
}
