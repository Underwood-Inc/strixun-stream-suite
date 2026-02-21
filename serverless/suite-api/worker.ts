/**
 * Suite API Worker
 *
 * Cloudflare Worker entry point for Stream Suite backend (cloud storage, notes, OBS, scrollbar CDN, legacy auth).
 * Wraps the router.js module to provide the fetch handler interface.
 *
 * @version 2.2.0 - Added migration architecture
 */

import type { ExecutionContext } from '@strixun/types';
import { getCorsHeaders } from './utils/cors.js';
import { route } from './router';

/**
 * Environment interface for Suite API Worker
 */
interface Env {
  SUITE_CACHE: KVNamespace;
  AUTH_SERVICE?: Fetcher;
  JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * Helper to ensure CORS headers are on response
 */
function ensureCORSHeaders(response: Response, corsHeaders: Record<string, string>): Response {
  // Clone response and merge CORS headers (CORS headers take precedence)
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
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

    // Use service binding for JWKS fetch when available (avoids same-zone 522 to auth.idling.app)
    const envForRequest = env.AUTH_SERVICE
      ? { ...env, JWKS_FETCH: (url: string) => env.AUTH_SERVICE!.fetch(url) }
      : env;
    const response = await route(request, envForRequest);
    return ensureCORSHeaders(response, corsHeaders);
  },
};
