/**
 * Strixun URL Shortener Service
 * 
 * Cloudflare Worker for URL shortening with OTP authentication integration
 * Provides free URL shortening service with user authentication
 * 
 * @version 2.2.0 - Added migration architecture
 */

import { initializeServiceTypes, type ExecutionContext } from '@strixun/types';
import { getCorsHeaders } from './utils/cors.js';
import { createRouter } from './router/routes.js';

// Initialize service types
initializeServiceTypes();

/**
 * Request handler
 */
async function handleRequest(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  const router = createRouter();
  return router(request, env);
}

/**
 * Main request handler with CORS support
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // Use service binding for JWKS fetch when available (avoids same-zone 522 to auth.idling.app)
    const envForRequest = env.AUTH_SERVICE
      ? { ...env, JWKS_FETCH: (url: string) => env.AUTH_SERVICE.fetch(url) }
      : env;
    return handleRequest(request, envForRequest, ctx);
  },
};
