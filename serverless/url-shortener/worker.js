/**
 * Strixun URL Shortener Service
 * 
 * Cloudflare Worker for URL shortening with OTP authentication integration
 * Provides free URL shortening service with user authentication
 * 
 * @version 1.0.0
 */

/**
 * Get CORS headers with dynamic origin whitelist
 * @param {*} env - Worker environment
 * @param {Request} request - Request object
 * @returns {Object} CORS headers
 */
function getCorsHeaders(env, request) {
  const origin = request.headers.get('Origin');
  
  // Get allowed origins from environment (comma-separated)
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
  
  // If no origins configured, allow all (for development only)
  // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
  const allowOrigin = allowedOrigins.length > 0 
      ? (origin && allowedOrigins.includes(origin) ? origin : null)
      : '*'; // Fallback for development
  
  return {
      'Access-Control-Allow-Origin': allowOrigin || 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
      'Access-Control-Max-Age': '86400',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  };
}

/**
 * Verify JWT token (compatible with OTP auth service)
 */
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(signatureInput)
    );

    if (!isValid) return null;

    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    );

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Get JWT secret from environment
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 * @throws {Error} If JWT_SECRET is not set
 */
function getJWTSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET. IMPORTANT: Use the SAME secret as your OTP auth service.');
  }
  return env.JWT_SECRET;
}

/**
 * Authenticate request using OTP auth JWT tokens
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, status: 401, error: 'Authorization header required' };
  }

  const token = authHeader.substring(7);
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return { authenticated: false, status: 401, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    userId: payload.userId,
    email: payload.email,
    customerId: payload.customerId || null,
  };
}

/**
 * Generate a short code for URL
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} Short code
 */
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate short code format
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid
 */
function isValidShortCode(code) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(code);
}

/**
 * Create short URL
 * POST /api/create
 */
async function handleCreateShortUrl(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { url, customCode, expiresIn } = body;

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return new Response(JSON.stringify({ error: 'Valid URL required (must start with http:// or https://)' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Validate custom code if provided
    let shortCode = customCode;
    if (shortCode) {
      if (!isValidShortCode(shortCode)) {
        return new Response(JSON.stringify({ error: 'Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores' }), {
          status: 400,
          headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
      }

      // Check if custom code already exists
      const existingKey = `url_${shortCode}`;
      const existing = await env.URL_KV.get(existingKey);
      if (existing) {
        return new Response(JSON.stringify({ error: 'Custom code already in use' }), {
          status: 409,
          headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Generate unique short code
      let attempts = 0;
      do {
        shortCode = generateShortCode(6);
        const existingKey = `url_${shortCode}`;
        const existing = await env.URL_KV.get(existingKey);
        if (!existing) break;
        attempts++;
        if (attempts > 10) {
          shortCode = generateShortCode(8); // Try longer code
        }
        if (attempts > 20) {
          return new Response(JSON.stringify({ error: 'Failed to generate unique code' }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
          });
        }
      } while (true);
    }

    // Calculate expiration TTL (default: 1 year, max: 10 years)
    let expirationTtl = 31536000; // 1 year in seconds
    if (expiresIn) {
      const expiresInNum = parseInt(expiresIn, 10);
      if (!isNaN(expiresInNum) && expiresInNum > 0) {
        expirationTtl = Math.min(expiresInNum, 315360000); // Max 10 years
      }
    }

    // Store URL mapping
    const urlData = {
      url,
      shortCode,
      userId: auth.userId,
      email: auth.email,
      createdAt: new Date().toISOString(),
      clickCount: 0,
      expiresAt: new Date(Date.now() + expirationTtl * 1000).toISOString(),
    };

    const urlKey = `url_${shortCode}`;
    await env.URL_KV.put(urlKey, JSON.stringify(urlData), { expirationTtl });

    // Store in user's URL list
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: 'json' }) || [];
    userUrls.push({
      shortCode,
      url,
      createdAt: urlData.createdAt,
      clickCount: 0,
    });
    await env.URL_KV.put(userUrlsKey, JSON.stringify(userUrls), { expirationTtl });

    // Get base URL from request
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    return new Response(JSON.stringify({
      success: true,
      shortUrl,
      shortCode,
      originalUrl: url,
      expiresAt: urlData.expiresAt,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to create short URL',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Redirect to original URL
 * GET /:shortCode
 */
async function handleRedirect(request, env) {
  try {
    const url = new URL(request.url);
    const shortCode = url.pathname.slice(1); // Remove leading /

    if (!shortCode || shortCode.includes('/')) {
      return new Response(JSON.stringify({ error: 'Invalid short code' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);

    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: 'Short URL not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlData = JSON.parse(urlDataStr);

    // Update click count
    urlData.clickCount = (urlData.clickCount || 0) + 1;
    await env.URL_KV.put(urlKey, JSON.stringify(urlData));

    // Track analytics
    const analyticsKey = `analytics_${shortCode}_${Date.now()}`;
    await env.ANALYTICS_KV.put(analyticsKey, JSON.stringify({
      shortCode,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
      referer: request.headers.get('Referer'),
      ip: request.headers.get('CF-Connecting-IP'),
    }), { expirationTtl: 31536000 }); // 1 year

    // Update user's URL list click count
    const userUrlsKey = `user_urls_${urlData.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: 'json' }) || [];
    const urlIndex = userUrls.findIndex(u => u.shortCode === shortCode);
    if (urlIndex !== -1) {
      userUrls[urlIndex].clickCount = urlData.clickCount;
      await env.URL_KV.put(userUrlsKey, JSON.stringify(userUrls));
    }

    // Redirect to original URL
    return Response.redirect(urlData.url, 302);
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to redirect',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get URL info
 * GET /api/info/:shortCode
 */
async function handleGetUrlInfo(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const shortCode = url.pathname.split('/').pop();

    if (!shortCode) {
      return new Response(JSON.stringify({ error: 'Short code required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);

    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: 'Short URL not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlData = JSON.parse(urlDataStr);

    // Check if user owns this URL
    if (urlData.userId !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    return new Response(JSON.stringify({
      success: true,
      shortUrl,
      shortCode,
      originalUrl: urlData.url,
      clickCount: urlData.clickCount || 0,
      createdAt: urlData.createdAt,
      expiresAt: urlData.expiresAt,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get URL info',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * List user's URLs
 * GET /api/list
 */
async function handleListUrls(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: 'json' }) || [];

    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

    // Enrich with full URLs
    const enrichedUrls = userUrls.map(u => ({
      ...u,
      shortUrl: `${baseUrl}/${u.shortCode}`,
    }));

    return new Response(JSON.stringify({
      success: true,
      urls: enrichedUrls,
      count: enrichedUrls.length,
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to list URLs',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Delete short URL
 * DELETE /api/delete/:shortCode
 */
async function handleDeleteUrl(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const shortCode = url.pathname.split('/').pop();

    if (!shortCode) {
      return new Response(JSON.stringify({ error: 'Short code required' }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);

    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: 'Short URL not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    const urlData = JSON.parse(urlDataStr);

    // Check if user owns this URL
    if (urlData.userId !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    // Delete URL
    await env.URL_KV.delete(urlKey);

    // Remove from user's URL list
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: 'json' }) || [];
    const filtered = userUrls.filter(u => u.shortCode !== shortCode);
    await env.URL_KV.put(userUrlsKey, JSON.stringify(filtered));

    return new Response(JSON.stringify({
      success: true,
      message: 'Short URL deleted',
    }), {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to delete URL',
      message: error.message,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Health check
 * GET /health
 */
async function handleHealth() {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'url-shortener',
    timestamp: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(env, request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' || path === '/') {
        return handleHealth();
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
  },
};

