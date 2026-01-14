/**
 * Twitch API Worker
 * 
 * Cloudflare Worker entry point for Twitch API proxy service
 * Wraps the router.js module to provide the fetch handler interface
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import type { ExecutionContext } from '@strixun/types';
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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
      });
      return new Response(null, { 
        status: 204,
        headers: Object.fromEntries(corsHeaders.entries())
      });
    }

    // Route to appropriate handler (router handles CORS headers in responses)
    return route(request, env);
  },
};

