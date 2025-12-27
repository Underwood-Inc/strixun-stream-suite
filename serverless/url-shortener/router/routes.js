/**
 * URL Shortener Router
 * 
 * Routes all requests to appropriate handlers
 * Uses shared encryption suite for automatic response encryption
 */

import { getCorsHeaders } from '../utils/cors.js';
import { handleCreateShortUrl, handleRedirect, handleGetUrlInfo, handleListUrls, handleDeleteUrl } from '../handlers/url.js';
import { handleHealth } from '../handlers/health.js';
import { handleDecryptScript } from '../handlers/decrypt-script.js';
import { handleOtpCoreScript } from '../handlers/otp-core-script.js';
import { handleAppAssets } from '../handlers/app-assets.js';

/**
 * Helper to wrap handlers with automatic encryption
 * Uses shared encryption suite from serverless/shared/encryption
 */
async function wrapWithEncryption(handlerResponse, request) {
  // Check if response should be encrypted (has JWT token and is OK)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  if (token && token.length >= 10 && handlerResponse.ok) {
    try {
      const contentType = handlerResponse.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const { encryptWithJWT } = await import('@strixun/api-framework');
        const responseData = await handlerResponse.json();
        const encrypted = await encryptWithJWT(responseData, token);
        
        const headers = new Headers(handlerResponse.headers);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Encrypted', 'true');
        
        return new Response(JSON.stringify(encrypted), {
          status: handlerResponse.status,
          statusText: handlerResponse.statusText,
          headers: headers,
        });
      }
    } catch (error) {
      console.error('Failed to encrypt response:', error);
    }
  }
  
  return handlerResponse;
}

export function createRouter() {
  return async function route(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check (moved before root to ensure it works)
      if (path === '/health') {
        return handleHealth();
      }

      // Serve decryption script
      if (path === '/decrypt.js' && request.method === 'GET') {
        return handleDecryptScript();
      }

      // Serve OTP core script
      if (path === '/otp-core.js' && request.method === 'GET') {
        return handleOtpCoreScript();
      }

      // API endpoints (require authentication)
      if (path === '/api/create' && request.method === 'POST') {
        const response = await handleCreateShortUrl(request, env);
        return await wrapWithEncryption(response, request);
      }

      if (path.startsWith('/api/info/') && request.method === 'GET') {
        const response = await handleGetUrlInfo(request, env);
        return await wrapWithEncryption(response, request);
      }

      if (path === '/api/list' && request.method === 'GET') {
        const response = await handleListUrls(request, env);
        return await wrapWithEncryption(response, request);
      }

      if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        const response = await handleDeleteUrl(request, env);
        return await wrapWithEncryption(response, request);
      }

      // Redirect endpoint (public, no auth required)
      // Check for short code redirects before serving app
      // Short codes are 3-20 alphanumeric characters
      if (request.method === 'GET' && path !== '/' && !path.startsWith('/api/') && /^\/[a-zA-Z0-9_-]{3,20}$/.test(path)) {
        const redirectResponse = await handleRedirect(request, env);
        // If redirect found, return it; otherwise fall through to app
        if (redirectResponse.status !== 404) {
          return redirectResponse;
        }
      }

      // Serve Svelte app (SPA routing - all non-API paths serve the app)
      if (request.method === 'GET' && !path.startsWith('/api/')) {
        return handleAppAssets(request, env);
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

