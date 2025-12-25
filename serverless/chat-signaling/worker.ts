/**
 * Strixun Chat Signaling Server
 * 
 * Minimal Cloudflare Worker for WebRTC signaling
 * Handles only initial connection setup - all messages go P2P after that
 * 
 * @version 2.0.0 - Modular architecture
 */

import { createEnhancedRouter } from '../shared/enhanced-router.js';
import { initializeServiceTypes } from '../shared/types.js';
import { getCorsHeaders } from './utils/cors.js';
import { route } from './router/routes.js';

/**
 * Original request handler
 */
async function originalFetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(env, request) });
  }

  return route(request, env);
}

// Initialize service types
initializeServiceTypes();

// Create enhanced router
const enhancedFetch = createEnhancedRouter(originalFetch);

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    return enhancedFetch(request, env, ctx);
  },
};

