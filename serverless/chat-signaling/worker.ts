/**
 * Strixun Chat Signaling Server
 * 
 * Minimal Cloudflare Worker for WebRTC signaling
 * Handles only initial connection setup - all messages go P2P after that
 * 
 * @version 2.0.0 - Modular architecture
 */

import { createCORSMiddleware } from '@strixun/api-framework/enhanced';
import { initializeServiceTypes } from '../shared/types.js';
import { route } from './router/routes.js';

/**
 * Request handler
 */
async function handleRequest(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  return route(request, env);
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

