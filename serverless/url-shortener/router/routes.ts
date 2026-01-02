/**
 * URL Shortener Router
 * 
 * Routes all requests to appropriate handlers
 * Uses shared encryption suite for automatic response encryption
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleCreateShortUrl, handleRedirect, handleGetUrlInfo, handleListUrls, handleDeleteUrl, handleGetStats } from '../handlers/url.js';
import { handleHealth } from '../handlers/health.js';
import { handleDecryptScript } from '../handlers/decrypt-script.js';
import { handleOtpCoreScript } from '../handlers/otp-core-script.js';
import { handleAppAssets } from '../handlers/app-assets.js';

interface Env {
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * Helper to wrap handlers with automatic encryption and integrity checks
 * Uses API framework's wrapWithEncryption for proper service-to-service support
 */
async function wrapWithEncryption(handlerResponse: Response, request: Request, env: Env, auth: any = null): Promise<Response> {
  try {
    // Use API framework's wrapWithEncryption for proper integrity headers and encryption
    const { wrapWithEncryption: apiWrapWithEncryption } = await import('@strixun/api-framework');
    const result = await apiWrapWithEncryption(handlerResponse, auth, request, env);
    return result.response;
  } catch (error) {
    console.error('[URL Shortener] Failed to wrap with encryption:', error);
    // Fallback to original response if encryption fails
    return handlerResponse;
  }
}

export function createRouter() {
  return async function route(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check (moved before root to ensure it works)
      if (path === '/health') {
        return handleHealth(request, env);
      }

      // Serve decryption script
      if (path === '/decrypt.js' && request.method === 'GET') {
        return handleDecryptScript(request, env);
      }

      // Serve OTP core script
      if (path === '/otp-core.js' && request.method === 'GET') {
        return handleOtpCoreScript(request, env);
      }

      // Public stats endpoint - now requires JWT encryption
      if (path === '/api/stats' && request.method === 'GET') {
        const response = await handleGetStats(request, env);
        const authHeader = request.headers.get('Authorization');
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        if (!jwtToken) {
          const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
            instance: request.url
          };
          const corsHeaders = getCorsHeaders(env, request);
          return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
              'Content-Type': 'application/problem+json',
              ...corsHeaders,
            },
          });
        }
        const auth = { userId: 'anonymous', customerId: null, jwtToken };
        return await wrapWithEncryption(response, request, env, auth);
      }

      // API endpoints (require authentication)
      if (path === '/api/create' && request.method === 'POST') {
        const response = await handleCreateShortUrl(request, env);
        // Extract auth from response if available, otherwise null
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      if (path.startsWith('/api/info/') && request.method === 'GET') {
        const response = await handleGetUrlInfo(request, env);
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      if (path === '/api/list' && request.method === 'GET') {
        const response = await handleListUrls(request, env);
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        const response = await handleDeleteUrl(request, env);
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      // Redirect endpoint - PUBLICLY ACCESSIBLE (no JWT required)
      // Short links need to work for anyone who clicks them, so redirects must be public
      // Check for short code redirects before serving app
      // Short codes are 3-20 alphanumeric characters
      if (request.method === 'GET' && path !== '/' && !path.startsWith('/api/') && /^\/[a-zA-Z0-9_-]{3,20}$/.test(path)) {
        const redirectResponse = await handleRedirect(request, env);
        // If redirect found, return it directly (redirects are public)
        // Otherwise fall through to app
        if (redirectResponse.status !== 404) {
          return redirectResponse;
        }
      }

      // Serve React app (SPA routing - all non-API paths serve the app)
      // App assets (HTML, JS, CSS) are PUBLICLY ACCESSIBLE - no JWT required
      // Users need to load the app to authenticate and get a JWT token
      if (request.method === 'GET' && !path.startsWith('/api/')) {
        // Serve app assets without encryption - they're static files needed for authentication
        const appResponse = await handleAppAssets(request, env);
        const corsHeaders = getCorsHeaders(env, request);
        return new Response(appResponse.body, {
          status: appResponse.status,
          headers: {
            ...corsHeaders,
            ...Object.fromEntries(appResponse.headers.entries()),
          },
        });
      }

      // Not found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: errorMessage,
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }
  };
}

