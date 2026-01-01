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

      // Redirect endpoint - now requires JWT encryption
      // Check for short code redirects before serving app
      // Short codes are 3-20 alphanumeric characters
      if (request.method === 'GET' && path !== '/' && !path.startsWith('/api/') && /^\/[a-zA-Z0-9_-]{3,20}$/.test(path)) {
        const redirectResponse = await handleRedirect(request, env);
        // If redirect found, encrypt and return it; otherwise fall through to app
        if (redirectResponse.status !== 404) {
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
          return await wrapWithEncryption(redirectResponse, request, env, auth);
        }
      }

      // Serve React app (SPA routing - all non-API paths serve the app)
      // CRITICAL: JWT binary encryption is MANDATORY for all binary responses
      if (request.method === 'GET' && !path.startsWith('/api/')) {
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
        const appResponse = await handleAppAssets(request, env);
        // App assets are binary (HTML, JS, CSS) - need binary encryption
        // Note: handleAppAssets should be updated to handle encryption internally
        // For now, we'll wrap it - but this may need adjustment based on handleAppAssets implementation
        const auth = { userId: 'anonymous', customerId: null, jwtToken };
        // Check if response is binary (HTML, JS, CSS)
        const contentType = appResponse.headers.get('Content-Type') || '';
        if (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css')) {
          // Binary encryption needed
          const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
          const bodyBytes = await appResponse.arrayBuffer();
          const encryptedBody = await encryptBinaryWithJWT(new Uint8Array(bodyBytes), jwtToken);
          const corsHeaders = getCorsHeaders(env, request);
          return new Response(encryptedBody, {
            status: appResponse.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/octet-stream',
              'X-Encrypted': 'true',
              'X-Original-Content-Type': contentType,
            },
          });
        }
        return await wrapWithEncryption(appResponse, request, env, auth);
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

