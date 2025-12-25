/**
 * Strixun URL Shortener Service
 * 
 * Cloudflare Worker for URL shortening with OTP authentication integration
 * Provides free URL shortening service with user authentication
 * 
 * @version 2.0.0 - Modular architecture
 */

import { createEnhancedRouter } from '../shared/enhanced-router.js';
import { initializeServiceTypes, type ExecutionContext } from '../shared/types.js';
import { createRouter } from './router/routes.js';
import { STANDALONE_HTML } from './templates/standalone.js';
import { getCorsHeaders } from './utils/cors.js';

/**
 * Original request handler
 */
async function originalFetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(env, request) });
  }

  // Create router with embedded HTML
  const router = createRouter(STANDALONE_HTML);
  return router(request, env);
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
