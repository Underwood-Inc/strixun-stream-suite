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

// Embedded standalone.html content
// This is automatically generated from standalone.html - do not edit manually
const STANDALONE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener - Strixun</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg: #0f0f0f;
            --card: #1a1a1a;
            --border: #2a2a2a;
            --text: #e0e0e0;
            --text-muted: #888;
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --secondary: #3a3a3a;
            --success: #10b981;
            --error: #ef4444;
            --warning: #f59e0b;
            --radius: 8px;
            --shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px 0;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, var(--primary), #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            color: var(--text-muted);
            font-size: 1.1rem;
        }

        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: var(--shadow);
        }

        .auth-section {
            text-align: center;
        }

        .auth-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--text);
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            padding: 12px 16px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            color: var(--text);
            font-size: 1rem;
            transition: border-color 0.2s;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--primary);
        }

        .form-group small {
            display: block;
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 0.875rem;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: var(--radius);
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-block;
            text-decoration: none;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background: var(--primary-hover);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }

        .btn-secondary {
            background: var(--secondary);
            color: var(--text);
        }

        .btn-secondary:hover:not(:disabled) {
            background: #4a4a4a;
        }

        .btn-danger {
            background: var(--error);
            color: white;
        }

        .btn-danger:hover:not(:disabled) {
            background: #dc2626;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .user-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
        }

        .user-info span {
            color: var(--text-muted);
        }

        .create-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
        }

        .urls-section h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
        }

        .url-card {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 15px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .url-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .url-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }

        .url-short {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }

        .url-short strong {
            color: var(--primary);
            font-size: 1.1rem;
            word-break: break-all;
        }

        .btn-copy {
            padding: 6px 12px;
            background: var(--secondary);
            border: none;
            border-radius: var(--radius);
            color: var(--text);
            cursor: pointer;
            font-size: 0.875rem;
            transition: background 0.2s;
        }

        .btn-copy:hover {
            background: #4a4a4a;
        }

        .url-original {
            margin-bottom: 12px;
        }

        .url-original a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.9rem;
            word-break: break-all;
        }

        .url-original a:hover {
            color: var(--primary);
            text-decoration: underline;
        }

        .url-meta {
            display: flex;
            gap: 15px;
            color: var(--text-muted);
            font-size: 0.875rem;
            flex-wrap: wrap;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--text-muted);
        }

        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 16px 20px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        }

        .toast.success {
            border-left: 4px solid var(--success);
        }

        .toast.error {
            border-left: 4px solid var(--error);
        }

        .toast.warning {
            border-left: 4px solid var(--warning);
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .otp-input-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .otp-input {
            flex: 1;
        }

        .otp-resend {
            white-space: nowrap;
        }

        .otp-timer {
            color: var(--text-muted);
            font-size: 0.875rem;
            margin-top: 8px;
        }

        @media (max-width: 600px) {
            .header h1 {
                font-size: 2rem;
            }

            .card {
                padding: 20px;
            }

            .user-info {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }

            .url-card-header {
                flex-direction: column;
                gap: 10px;
            }

            .btn-group {
                width: 100%;
            }

            .btn-group .btn {
                flex: 1;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔗 URL Shortener</h1>
            <p>Create and manage short URLs with OTP authentication</p>
        </div>

        <!-- Authentication Section -->
        <div id="authSection" class="card auth-section">
            <h2>Sign In</h2>
            <div id="authStep1">
                <div class="form-group">
                    <label for="emailInput">Email Address</label>
                    <input 
                        type="email" 
                        id="emailInput" 
                        placeholder="your@email.com"
                        autocomplete="email"
                    >
                </div>
                <button class="btn btn-primary" onclick="requestOTP()">
                    Send OTP Code
                </button>
            </div>
            <div id="authStep2" style="display: none;">
                <div class="form-group">
                    <label for="otpInput">Enter 6-digit OTP Code</label>
                    <div class="otp-input-group">
                        <input 
                            type="text" 
                            id="otpInput" 
                            placeholder="000000"
                            maxlength="6"
                            pattern="[0-9]{6}"
                            class="otp-input"
                            onkeypress="return /[0-9]/.test(event.key)"
                            oninput="this.value = this.value.replace(/[^0-9]/g, '')"
                        >
                        <button class="btn btn-secondary otp-resend" onclick="requestOTP()" id="resendBtn">
                            Resend
                        </button>
                    </div>
                    <small>Check your email for the 6-digit code</small>
                    <div id="otpTimer" class="otp-timer"></div>
                </div>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="verifyOTP()">
                        Verify & Sign In
                    </button>
                    <button class="btn btn-secondary" onclick="backToEmail()">
                        Back
                    </button>
                </div>
            </div>
        </div>

        <!-- Main App Section -->
        <div id="appSection" style="display: none;">
            <div class="card">
                <div class="user-info">
                    <div>
                        <strong>Signed in as:</strong> <span id="userEmail"></span>
                    </div>
                    <button class="btn btn-secondary" onclick="logout()">
                        Sign Out
                    </button>
                </div>
            </div>

            <!-- Create URL Section -->
            <div class="card create-section">
                <h2>Create Short URL</h2>
                <div class="form-group">
                    <label for="urlInput">URL to shorten</label>
                    <input 
                        type="url" 
                        id="urlInput" 
                        placeholder="https://example.com/very/long/url"
                        autocomplete="off"
                    >
                </div>
                <div class="form-group">
                    <label for="customCodeInput">Custom code (optional)</label>
                    <input 
                        type="text" 
                        id="customCodeInput" 
                        placeholder="mycode"
                        pattern="[a-zA-Z0-9_-]{3,20}"
                        autocomplete="off"
                    >
                    <small>3-20 characters, letters, numbers, hyphens, and underscores only</small>
                </div>
                <button class="btn btn-primary" onclick="createShortUrl()" id="createBtn">
                    Create Short URL
                </button>
            </div>

            <!-- URLs List Section -->
            <div class="card urls-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Your Short URLs</h2>
                    <button class="btn btn-secondary" onclick="loadUrls()" id="refreshBtn">
                        🔄 Refresh
                    </button>
                </div>
                <div id="urlsList">
                    <div class="loading">Loading URLs...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration - Update these with your actual API URLs
        const OTP_AUTH_API_URL = 'https://auth.idling.app';
        const URL_SHORTENER_API_URL = 'https://s.idling.app';

        // State
        let authToken = null;
        let userEmail = null;
        let otpTimer = null;
        let otpTimerInterval = null;

        // Initialize
        window.addEventListener('DOMContentLoaded', () => {
            // Check for stored token
            const storedToken = localStorage.getItem('urlShortenerToken');
            const storedEmail = localStorage.getItem('urlShortenerEmail');
            
            if (storedToken && storedEmail) {
                authToken = storedToken;
                userEmail = storedEmail;
                showApp();
            } else {
                showAuth();
            }
        });

        // Authentication Functions
        async function requestOTP() {
            const email = document.getElementById('emailInput').value.trim();
            
            if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
                showToast('Please enter a valid email address', 'error');
                return;
            }

            const resendBtn = document.getElementById('resendBtn');
            resendBtn.disabled = true;

            try {
                const response = await fetch(\`\${OTP_AUTH_API_URL}/auth/request-otp\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                });

                const data = await response.json();

                if (response.ok) {
                    showToast('OTP code sent to your email!', 'success');
                    document.getElementById('authStep1').style.display = 'none';
                    document.getElementById('authStep2').style.display = 'block';
                    document.getElementById('otpInput').focus();
                    
                    // Start OTP timer (10 minutes)
                    startOTPTimer();
                } else {
                    showToast(data.error || 'Failed to send OTP', 'error');
                    resendBtn.disabled = false;
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                resendBtn.disabled = false;
            }
        }

        async function verifyOTP() {
            const email = document.getElementById('emailInput').value.trim();
            const otp = document.getElementById('otpInput').value.trim();

            if (!otp || !/^\\d{6}$/.test(otp)) {
                showToast('Please enter a valid 6-digit OTP code', 'error');
                return;
            }

            const verifyBtn = event.target;
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'Verifying...';

            try {
                const response = await fetch(\`\${OTP_AUTH_API_URL}/auth/verify-otp\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, otp }),
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    authToken = data.token;
                    userEmail = email;
                    
                    // Store token
                    localStorage.setItem('urlShortenerToken', authToken);
                    localStorage.setItem('urlShortenerEmail', userEmail);
                    
                    showToast('Successfully signed in!', 'success');
                    stopOTPTimer();
                    showApp();
                } else {
                    showToast(data.error || 'Invalid OTP code', 'error');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify & Sign In';
                    
                    if (data.remainingAttempts !== undefined) {
                        showToast(\`Remaining attempts: \${data.remainingAttempts}\`, 'warning');
                    }
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify & Sign In';
            }
        }

        function backToEmail() {
            document.getElementById('authStep1').style.display = 'block';
            document.getElementById('authStep2').style.display = 'none';
            document.getElementById('otpInput').value = '';
            stopOTPTimer();
        }

        function logout() {
            authToken = null;
            userEmail = null;
            localStorage.removeItem('urlShortenerToken');
            localStorage.removeItem('urlShortenerEmail');
            showAuth();
            showToast('Signed out successfully', 'success');
        }

        function showAuth() {
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('appSection').style.display = 'none';
            document.getElementById('emailInput').value = '';
            document.getElementById('otpInput').value = '';
            backToEmail();
        }

        function showApp() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('appSection').style.display = 'block';
            document.getElementById('userEmail').textContent = userEmail;
            loadUrls();
        }

        // OTP Timer
        function startOTPTimer() {
            let timeLeft = 600; // 10 minutes in seconds
            const timerEl = document.getElementById('otpTimer');
            const resendBtn = document.getElementById('resendBtn');
            
            otpTimerInterval = setInterval(() => {
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                timerEl.textContent = \`Code expires in \${minutes}:\${seconds.toString().padStart(2, '0')}\`;
                
                timeLeft--;
                
                if (timeLeft < 0) {
                    stopOTPTimer();
                    timerEl.textContent = 'OTP code expired. Please request a new one.';
                    resendBtn.disabled = false;
                }
            }, 1000);
        }

        function stopOTPTimer() {
            if (otpTimerInterval) {
                clearInterval(otpTimerInterval);
                otpTimerInterval = null;
            }
            document.getElementById('otpTimer').textContent = '';
            document.getElementById('resendBtn').disabled = false;
        }

        // URL Shortener Functions
        async function createShortUrl() {
            const url = document.getElementById('urlInput').value.trim();
            const customCode = document.getElementById('customCodeInput').value.trim();

            if (!url) {
                showToast('Please enter a URL to shorten', 'error');
                return;
            }

            if (!isValidUrl(url)) {
                showToast('Please enter a valid URL (must start with http:// or https://)', 'error');
                return;
            }

            if (customCode && !/^[a-zA-Z0-9_-]{3,20}$/.test(customCode)) {
                showToast('Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores', 'error');
                return;
            }

            const createBtn = document.getElementById('createBtn');
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/create\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                    body: JSON.stringify({
                        url,
                        customCode: customCode || undefined,
                    }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast(\`Short URL created: \${data.shortUrl}\`, 'success');
                    document.getElementById('urlInput').value = '';
                    document.getElementById('customCodeInput').value = '';
                    loadUrls();
                } else {
                    showToast(data.error || 'Failed to create short URL', 'error');
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            } finally {
                createBtn.disabled = false;
                createBtn.textContent = 'Create Short URL';
            }
        }

        async function loadUrls() {
            const urlsList = document.getElementById('urlsList');
            const refreshBtn = document.getElementById('refreshBtn');
            
            urlsList.innerHTML = '<div class="loading">Loading URLs...</div>';
            refreshBtn.disabled = true;

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/list\`, {
                    headers: {
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.urls && data.urls.length > 0) {
                        urlsList.innerHTML = data.urls.map(url => \`
                            <div class="url-card">
                                <div class="url-card-header">
                                    <div class="url-short">
                                        <strong>\${escapeHtml(url.shortUrl)}</strong>
                                        <button class="btn-copy" onclick="copyToClipboard('\${escapeHtml(url.shortUrl)}')" title="Copy to clipboard">
                                            📋 Copy
                                        </button>
                                    </div>
                                    <button class="btn btn-danger" onclick="deleteUrl('\${escapeHtml(url.shortCode)}')" title="Delete">
                                        🗑️ Delete
                                    </button>
                                </div>
                                <div class="url-original">
                                    <a href="\${escapeHtml(url.url)}" target="_blank" rel="noopener noreferrer">
                                        \${escapeHtml(url.url)}
                                    </a>
                                </div>
                                <div class="url-meta">
                                    <span>Created: \${new Date(url.createdAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>Clicks: \${url.clickCount || 0}</span>
                                </div>
                            </div>
                        \`).join('');
                    } else {
                        urlsList.innerHTML = '<div class="empty-state">No short URLs yet. Create your first one above!</div>';
                    }
                } else {
                    if (response.status === 401) {
                        showToast('Session expired. Please sign in again.', 'error');
                        logout();
                    } else {
                        showToast(data.error || 'Failed to load URLs', 'error');
                        urlsList.innerHTML = '<div class="empty-state">Failed to load URLs</div>';
                    }
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
                urlsList.innerHTML = '<div class="empty-state">Network error</div>';
            } finally {
                refreshBtn.disabled = false;
            }
        }

        async function deleteUrl(shortCode) {
            if (!confirm('Are you sure you want to delete this short URL?')) {
                return;
            }

            try {
                const response = await fetch(\`\${URL_SHORTENER_API_URL}/api/delete/\${shortCode}\`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${authToken}\`,
                    },
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast('Short URL deleted successfully', 'success');
                    loadUrls();
                } else {
                    if (response.status === 401) {
                        showToast('Session expired. Please sign in again.', 'error');
                        logout();
                    } else {
                        showToast(data.error || 'Failed to delete URL', 'error');
                    }
                }
            } catch (error) {
                showToast('Network error. Please try again.', 'error');
            }
        }

        // Utility Functions
        function isValidUrl(url) {
            try {
                const urlObj = new URL(url);
                return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
                return false;
            }
        }

        async function copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                showToast('Copied to clipboard!', 'success');
            } catch (error) {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showToast('Copied to clipboard!', 'success');
                } catch (err) {
                    showToast('Failed to copy to clipboard', 'error');
                }
                document.body.removeChild(textarea);
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }

        // Allow Enter key to submit forms
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (document.getElementById('emailInput') === document.activeElement) {
                    requestOTP();
                } else if (document.getElementById('otpInput') === document.activeElement) {
                    verifyOTP();
                } else if (document.getElementById('urlInput') === document.activeElement) {
                    createShortUrl();
                }
            }
        });
    </script>
</body>
</html>`;

/**
 * Serve standalone HTML page
 * GET /
 * 
 * Note: The HTML is embedded directly in the worker for simplicity.
 * For production, consider using Workers Assets or a separate static hosting solution.
 */
function handleStandalonePage() {
  // HTML content is embedded above - this is the standalone.html file content
  const html = STANDALONE_HTML;
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
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
      // Health check (moved before root to ensure it works)
      if (path === '/health') {
        return handleHealth();
      }

      // Serve standalone HTML page at root
      if (path === '/' && request.method === 'GET') {
        return handleStandalonePage();
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

