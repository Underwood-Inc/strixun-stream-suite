/**
 * Health Check Handler
 * 
 * Health check endpoint for Chat Signaling worker
 */

import { getCorsHeaders } from '../utils/cors.js';

/**
 * Health check
 * GET /health
 */
export async function handleHealth(request, env) {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'chat-signaling',
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
  });
}

