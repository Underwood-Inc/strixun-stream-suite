/**
 * Music API Service - Cloudflare Worker
 * 
 * Dedicated worker for fetching copyright-free music from external sources
 * Provides API endpoints for searching and retrieving music tracks
 * 
 * @version 1.1.0 - Added migration architecture
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
import { getCorsHeaders } from './utils/cors.js';
import { createError } from './utils/errors.js';
import { handleMusicRoutes } from './router/music-routes.js';
import type { Env } from './types.js';

/**
 * Health check endpoint
 */
async function handleHealth(env: Env, request: Request): Promise<Response> {
  const healthData = {
    status: 'ok',
    message: 'Music API is running',
    service: 'strixun-music-api',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
  };
  
  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env, request),
    },
  });
}

/**
 * Main request handler
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Health check
    if (path === '/health') {
      return await handleHealth(env, request);
    }

    // Handle music routes
    const musicResult = await handleMusicRoutes(request, path, env);
    if (musicResult) {
      return musicResult.response;
    }

    // 404 for unknown routes
    const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
    return new Response(JSON.stringify(rfcError), {
      status: 404,
      headers: {
        'Content-Type': 'application/problem+json',
        ...getCorsHeaders(env, request),
      },
    });
  } catch (error: any) {
    console.error('Request handler error:', error);
    
    const rfcError = createError(
      request,
      500,
      'Internal Server Error',
      env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
    );
    return new Response(JSON.stringify(rfcError), {
      status: 500,
      headers: {
        'Content-Type': 'application/problem+json',
        ...getCorsHeaders(env, request),
      },
    });
  }
}

/**
 * Export worker with CORS support
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const corsHeaders = getCorsHeaders(env, request);
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    
    return handleRequest(request, env, ctx);
  },
};
