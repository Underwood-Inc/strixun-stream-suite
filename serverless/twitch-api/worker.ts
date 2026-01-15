/**
 * Twitch API Worker
 * 
 * Cloudflare Worker entry point for Twitch API proxy service
 * Wraps the router.js module to provide the fetch handler interface
 * 
 * @version 2.1.0 - Uses standardized CORS from api-framework
 */

import type { ExecutionContext } from '@strixun/types';
import { getCorsHeaders } from './utils/cors.js';
import { route } from './router';

/**
 * Environment interface for Twitch API Worker
 */
interface Env {
  TWITCH_CACHE: KVNamespace;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * Cloudflare Worker fetch handler
 * 
 * @param request - The incoming request
 * @param env - Worker environment variables and bindings
 * @param ctx - Execution context
 * @returns Response promise
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Route to appropriate handler (router handles CORS headers in responses)
    return route(request, env);
  },
};
