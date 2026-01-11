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
  // Get JWT token from request
  const authHeader = request.headers.get('Authorization');
  const jwtToken = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  if (!jwtToken) {
    // Return 401 with problem+json format
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
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

  // Wrap with encryption to ensure JWT encryption is applied
  const encryptedResult = await wrapWithEncryption(
    response, 
    authForEncryption, 
    request, 
    env
  );
  
  return encryptedResult.response;
}
