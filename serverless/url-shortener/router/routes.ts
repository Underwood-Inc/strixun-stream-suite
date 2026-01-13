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
import { handleGetDisplayName } from '../handlers/display-name.js';

interface Env {
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

/**
 * Helper to wrap handlers with automatic encryption and integrity checks
 * Uses API framework's wrapWithEncryption for proper service-to-service support
 * CRITICAL: Disables encryption for HttpOnly cookie auth (browser can't decrypt)
 */
async function wrapWithEncryption(handlerResponse: Response, request: Request, env: Env, auth: any = null): Promise<Response> {
  try {
    // Use API framework's wrapWithEncryption for proper integrity headers and encryption
    // CRITICAL: Pass null to disable encryption for HttpOnly cookies (JavaScript can't decrypt)
    const { wrapWithEncryption: apiWrapWithEncryption } = await import('@strixun/api-framework');
    const result = await apiWrapWithEncryption(handlerResponse, null, request, env, {
      requireJWT: false // Disable encryption for HttpOnly cookie auth
    });
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
        
        // ONLY check HttpOnly cookie - NO fallbacks, NO Authorization header
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) {
          const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
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
        
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (!authCookie) {
          const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
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
        
        const jwtToken = authCookie.substring('auth_token='.length).trim();
        const auth = { userId: 'anonymous', customerId: null, jwtToken };
        return await wrapWithEncryption(response, request, env, auth);
      }

      // API endpoints (require authentication)
      if (path === '/api/create' && request.method === 'POST') {
        const response = await handleCreateShortUrl(request, env);
        // Extract JWT from HttpOnly cookie ONLY - NO Authorization header fallback
        let token: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').map(c => c.trim());
          const authCookie = cookies.find(c => c.startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
          }
        }
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      if (path.startsWith('/api/info/') && request.method === 'GET') {
        const response = await handleGetUrlInfo(request, env);
        // Extract JWT from HttpOnly cookie ONLY - NO Authorization header fallback
        let token: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').map(c => c.trim());
          const authCookie = cookies.find(c => c.startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
          }
        }
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      if (path === '/api/list' && request.method === 'GET') {
        try {
          const response = await handleListUrls(request, env);
          
          // If response is already an error (401, 500, etc.), return it directly without encryption
          if (response.status >= 400) {
            return response;
          }
          
          // Extract auth info for encryption - from HttpOnly cookie ONLY
          let token: string | null = null;
          const cookieHeader = request.headers.get('Cookie');
          if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
              token = authCookie.substring('auth_token='.length).trim();
            }
          }
          
          // Only wrap with encryption if we have a token and response is successful
          if (token && response.status < 400) {
            try {
              const auth = { jwtToken: token };
              return await wrapWithEncryption(response, request, env, auth);
            } catch (encryptError) {
              console.error('[URL Shortener] Encryption failed for /api/list, returning unencrypted:', encryptError);
              // Fallback to unencrypted response if encryption fails
              return response;
            }
          }
          
          // If no token but response is OK, return unencrypted (shouldn't happen - auth should fail first)
          return response;
        } catch (routeError) {
          console.error('[URL Shortener] Route handler error for /api/list:', routeError);
          const errorMessage = routeError instanceof Error ? routeError.message : String(routeError);
          return new Response(JSON.stringify({
            error: 'Internal server error',
            message: errorMessage,
          }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
          });
        }
      }

      if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
        const response = await handleDeleteUrl(request, env);
        // Extract JWT from HttpOnly cookie ONLY - NO Authorization header fallback
        let token: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').map(c => c.trim());
          const authCookie = cookies.find(c => c.startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
          }
        }
        const auth = token ? { jwtToken: token } : null;
        return await wrapWithEncryption(response, request, env, auth);
      }

      // Get display name endpoint - uses customer API as source of truth
      if (path === '/api/display-name' && request.method === 'GET') {
        const response = await handleGetDisplayName(request, env);
        // Extract JWT from HttpOnly cookie ONLY - NO Authorization header fallback
        let token: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
          const cookies = cookieHeader.split(';').map(c => c.trim());
          const authCookie = cookies.find(c => c.startsWith('auth_token='));
          if (authCookie) {
            token = authCookie.substring('auth_token='.length).trim();
          }
        }
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

