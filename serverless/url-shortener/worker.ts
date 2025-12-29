/**
 * Strixun URL Shortener Service
 * 
 * Cloudflare Worker for URL shortening with OTP authentication integration
 * Provides free URL shortening service with user authentication
 * 
 * @version 2.0.0 - Modular architecture
 */

import { createCORSMiddleware } from '@strixun/api-framework/enhanced';
import { initializeServiceTypes, ExecutionContext } from '../shared/types.js';
import { createRouter } from './router/routes.js';

/**
 * Request handler
 */
async function handleRequest(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  const router = createRouter();
  return router(request, env);
}

// Initialize service types
initializeServiceTypes();

// Create CORS middleware
const corsMiddleware = createCORSMiddleware({});

/**
 * Main request handler with CORS support
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsMiddleware(request, async () => new Response(null, { status: 204 }));
    }
    
    // Handle request with CORS
    return corsMiddleware(request, async (req) => handleRequest(req, env, ctx));
  },
};
