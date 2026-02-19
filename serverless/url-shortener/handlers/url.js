/**
 * URL Shortener Handlers
 * 
 * Handles all URL shortening operations
 */

import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import { generateShortCode, isValidUrl, isValidShortCode } from '../utils/url.js';

/**
 * Create short URL
 * POST /api/create
 */
export async function handleCreateShortUrl(request, env) {
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
      // Note: Deleted URLs release their slugs immediately, so previously used slugs can be reused
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
      // Note: Deleted URLs release their slugs immediately, so previously used slugs can be reused
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

    // Increment total URL counter (for all users)
    const totalCountKey = 'total_urls_count';
    const currentCount = parseInt(await env.URL_KV.get(totalCountKey) || '0', 10);
    await env.URL_KV.put(totalCountKey, String(currentCount + 1));

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
export async function handleRedirect(request, env) {
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
export async function handleGetUrlInfo(request, env) {
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
export async function handleListUrls(request, env) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status || 401,
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
      });
    }

    if (!auth.userId) {
      console.error('[List URLs] No userId in auth result:', auth);
      return new Response(JSON.stringify({ 
        error: 'Authentication failed',
        detail: 'User ID not found in token'
      }), {
        status: 401,
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
    console.error('[List URLs] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      error: 'Failed to list URLs',
      message: errorMessage,
      detail: env.ENVIRONMENT === 'development' ? error.stack : undefined,
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Get total URL count (public, service-to-service only)
 * GET /api/stats
 */
export async function handleGetStats(request, env) {
  try {
    // Get total count from KV
    const totalCountKey = 'total_urls_count';
    const countStr = await env.URL_KV.get(totalCountKey);
    const totalCount = countStr ? parseInt(countStr, 10) : 0;

    // Return with no-cache headers to ensure fresh data on each request
    return new Response(JSON.stringify({
      success: true,
      totalUrls: totalCount,
    }), {
      status: 200,
      headers: {
        ...getCorsHeaders(env, request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get stats',
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
export async function handleDeleteUrl(request, env) {
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

    // Delete URL - this automatically releases the slug for reuse by anyone
    // The slug becomes immediately available for new shortened URLs (both custom and auto-generated)
    await env.URL_KV.delete(urlKey);

    // Remove from user's URL list
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: 'json' }) || [];
    const filtered = userUrls.filter(u => u.shortCode !== shortCode);
    await env.URL_KV.put(userUrlsKey, JSON.stringify(filtered));

    // Decrement total URL counter (for all users)
    const totalCountKey = 'total_urls_count';
    const currentCount = parseInt(await env.URL_KV.get(totalCountKey) || '0', 10);
    if (currentCount > 0) {
      await env.URL_KV.put(totalCountKey, String(currentCount - 1));
    }

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

