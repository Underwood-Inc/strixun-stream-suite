/**
 * Health Check Handler
 * 
 * Health check endpoint for URL Shortener worker
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */

import { wrapWithEncryption } from '@strixun/api-framework';
import { getCorsHeaders } from '../utils/cors.js';

/**
 * Health check
 * GET /health
 */
export async function handleHealth(request, env) {
  // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
  // Get JWT token from request
  const authHeader = request.headers.get('Authorization');
  const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (!jwtToken) {
    const errorResponse = {
      type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
      title: 'Unauthorized',
      status: 401,
      detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
      instance: request.url
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
  const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };

  // Create health check response
  const healthData = {
    status: 'ok',
    service: 'url-shortener',
    timestamp: new Date().toISOString(),
  };
  
  const response = new Response(JSON.stringify(healthData), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Wrap with encryption to ensure JWT encryption is applied
  const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
  return encryptedResult.response;
}

