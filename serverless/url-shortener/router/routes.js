/**
 * URL Shortener Router
 * 
 * Routes all requests to appropriate handlers
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleCreateShortUrl, handleRedirect, handleGetUrlInfo, handleListUrls, handleDeleteUrl } from '../handlers/url.js';
import { handleHealth } from '../handlers/health.js';
import { handleStandalonePage } from '../handlers/page.js';

// Import standalone HTML content
// In Cloudflare Workers, we need to embed the HTML as a string
// This will be passed from worker.js
export function createRouter(standaloneHtml) {
  return async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check (moved before root to ensure it works)
      if (path === '/health') {
        return handleHealth();
      }

      // Serve standalone HTML page at root
      if (path === '/' && request.method === 'GET') {
        return handleStandalonePage(standaloneHtml);
      }

      // API endpoints (require authentication)
      if (path === '/api/create' && request.method === 'POST') {
        return handleCreateShortUrl(request, env);
      }

      if (path.startsWith('/api/info/') && request.method === 'GET') {
        return handleGetUrlInfo(request, env);
      }

      if (path === '/api/list' && request.method === 'GET') {
        return handleListUrls(request, env);
      }

      if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        return handleDeleteUrl(request, env);
      }

      // Redirect endpoint (public, no auth required)
      // This must be last to catch all other paths
      if (request.method === 'GET' && path !== '/api' && !path.startsWith('/api/')) {
        return handleRedirect(request, env);
      }

      // Not found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }
  };
}

