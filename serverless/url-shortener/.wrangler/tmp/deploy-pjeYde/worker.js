var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
function getCorsHeaders(env, request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : [];
  const allowOrigin = allowedOrigins.length > 0 ? origin && allowedOrigins.includes(origin) ? origin : null : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin || "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": allowOrigin !== "*" ? "true" : "false",
    "Access-Control-Max-Age": "86400",
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signatureInput)
    );
    if (!isValid) return null;
    const payload = JSON.parse(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
function getJWTSecret(env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET. IMPORTANT: Use the SAME secret as your OTP auth service.");
  }
  return env.JWT_SECRET;
}
__name(getJWTSecret, "getJWTSecret");
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, status: 401, error: "Authorization header required" };
  }
  const token = authHeader.substring(7);
  const jwtSecret = getJWTSecret(env);
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return { authenticated: false, status: 401, error: "Invalid or expired token" };
  }
  return {
    authenticated: true,
    // Support both old format (userId) and OIDC format (sub)
    userId: payload.userId || payload.sub,
    email: payload.email,
    customerId: payload.customerId || payload.aud || null
  };
}
__name(authenticateRequest, "authenticateRequest");
function generateShortCode(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}
__name(generateShortCode, "generateShortCode");
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}
__name(isValidUrl, "isValidUrl");
function isValidShortCode(code) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(code);
}
__name(isValidShortCode, "isValidShortCode");
async function handleCreateShortUrl(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const body = await request.json();
    const { url, customCode, expiresIn } = body;
    if (!url || !isValidUrl(url)) {
      return new Response(JSON.stringify({ error: "Valid URL required (must start with http:// or https://)" }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    let shortCode = customCode;
    if (shortCode) {
      if (!isValidShortCode(shortCode)) {
        return new Response(JSON.stringify({ error: "Custom code must be 3-20 characters and contain only letters, numbers, hyphens, and underscores" }), {
          status: 400,
          headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
        });
      }
      const existingKey = `url_${shortCode}`;
      const existing = await env.URL_KV.get(existingKey);
      if (existing) {
        return new Response(JSON.stringify({ error: "Custom code already in use" }), {
          status: 409,
          headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
        });
      }
    } else {
      let attempts = 0;
      do {
        shortCode = generateShortCode(6);
        const existingKey = `url_${shortCode}`;
        const existing = await env.URL_KV.get(existingKey);
        if (!existing) break;
        attempts++;
        if (attempts > 10) {
          shortCode = generateShortCode(8);
        }
        if (attempts > 20) {
          return new Response(JSON.stringify({ error: "Failed to generate unique code" }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
          });
        }
      } while (true);
    }
    let expirationTtl = 31536e3;
    if (expiresIn) {
      const expiresInNum = parseInt(expiresIn, 10);
      if (!isNaN(expiresInNum) && expiresInNum > 0) {
        expirationTtl = Math.min(expiresInNum, 31536e4);
      }
    }
    const urlData = {
      url,
      shortCode,
      userId: auth.userId,
      email: auth.email,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      clickCount: 0,
      expiresAt: new Date(Date.now() + expirationTtl * 1e3).toISOString()
    };
    const urlKey = `url_${shortCode}`;
    await env.URL_KV.put(urlKey, JSON.stringify(urlData), { expirationTtl });
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: "json" }) || [];
    userUrls.push({
      shortCode,
      url,
      createdAt: urlData.createdAt,
      clickCount: 0
    });
    await env.URL_KV.put(userUrlsKey, JSON.stringify(userUrls), { expirationTtl });
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const shortUrl = `${baseUrl}/${shortCode}`;
    return new Response(JSON.stringify({
      success: true,
      shortUrl,
      shortCode,
      originalUrl: url,
      expiresAt: urlData.expiresAt
    }), {
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to create short URL",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleCreateShortUrl, "handleCreateShortUrl");
async function handleRedirect(request, env) {
  try {
    const url = new URL(request.url);
    const shortCode = url.pathname.slice(1);
    if (!shortCode || shortCode.includes("/")) {
      return new Response(JSON.stringify({ error: "Invalid short code" }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);
    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: "Short URL not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlData = JSON.parse(urlDataStr);
    urlData.clickCount = (urlData.clickCount || 0) + 1;
    await env.URL_KV.put(urlKey, JSON.stringify(urlData));
    const analyticsKey = `analytics_${shortCode}_${Date.now()}`;
    await env.ANALYTICS_KV.put(analyticsKey, JSON.stringify({
      shortCode,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      userAgent: request.headers.get("User-Agent"),
      referer: request.headers.get("Referer"),
      ip: request.headers.get("CF-Connecting-IP")
    }), { expirationTtl: 31536e3 });
    const userUrlsKey = `user_urls_${urlData.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: "json" }) || [];
    const urlIndex = userUrls.findIndex((u) => u.shortCode === shortCode);
    if (urlIndex !== -1) {
      userUrls[urlIndex].clickCount = urlData.clickCount;
      await env.URL_KV.put(userUrlsKey, JSON.stringify(userUrls));
    }
    return Response.redirect(urlData.url, 302);
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to redirect",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleRedirect, "handleRedirect");
async function handleGetUrlInfo(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const url = new URL(request.url);
    const shortCode = url.pathname.split("/").pop();
    if (!shortCode) {
      return new Response(JSON.stringify({ error: "Short code required" }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);
    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: "Short URL not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlData = JSON.parse(urlDataStr);
    if (urlData.userId !== auth.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
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
      expiresAt: urlData.expiresAt
    }), {
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to get URL info",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleGetUrlInfo, "handleGetUrlInfo");
async function handleListUrls(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: "json" }) || [];
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    const enrichedUrls = userUrls.map((u) => ({
      ...u,
      shortUrl: `${baseUrl}/${u.shortCode}`
    }));
    return new Response(JSON.stringify({
      success: true,
      urls: enrichedUrls,
      count: enrichedUrls.length
    }), {
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to list URLs",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleListUrls, "handleListUrls");
async function handleDeleteUrl(request, env) {
  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const url = new URL(request.url);
    const shortCode = url.pathname.split("/").pop();
    if (!shortCode) {
      return new Response(JSON.stringify({ error: "Short code required" }), {
        status: 400,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlKey = `url_${shortCode}`;
    const urlDataStr = await env.URL_KV.get(urlKey);
    if (!urlDataStr) {
      return new Response(JSON.stringify({ error: "Short URL not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    const urlData = JSON.parse(urlDataStr);
    if (urlData.userId !== auth.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
    await env.URL_KV.delete(urlKey);
    const userUrlsKey = `user_urls_${auth.userId}`;
    const userUrls = await env.URL_KV.get(userUrlsKey, { type: "json" }) || [];
    const filtered = userUrls.filter((u) => u.shortCode !== shortCode);
    await env.URL_KV.put(userUrlsKey, JSON.stringify(filtered));
    return new Response(JSON.stringify({
      success: true,
      message: "Short URL deleted"
    }), {
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Failed to delete URL",
      message: error.message
    }), {
      status: 500,
      headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
    });
  }
}
__name(handleDeleteUrl, "handleDeleteUrl");
async function handleHealth() {
  return new Response(JSON.stringify({
    status: "ok",
    service: "url-shortener",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleHealth, "handleHealth");
var STANDALONE_HTML = `<!DOCTYPE html>
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
            /* Strixun Stream Suite Design System */
            --bg: #1a1611;
            --bg-dark: #0f0e0b;
            --card: #252017;
            --border: #3d3627;
            --border-light: #4a4336;
            
            /* Brand Colors */
            --accent: #edae49;
            --accent-light: #f9df74;
            --accent-dark: #c68214;
            --accent2: #6495ed;
            
            /* Status Colors */
            --success: #28a745;
            --warning: #ffc107;
            --danger: #ea2b1f;
            --info: #6495ed;
            
            /* Text Colors */
            --text: #f9f9f9;
            --text-secondary: #b8b8b8;
            --muted: #888;
            
            /* Legacy aliases for compatibility */
            --primary: var(--accent);
            --primary-hover: var(--accent-dark);
            --secondary: var(--border);
            --error: var(--danger);
            --text-muted: var(--muted);
            
            --radius: 8px;
            --shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
            margin: 0;
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
            background: linear-gradient(135deg, var(--accent), var(--accent-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            color: var(--muted);
            font-size: 1.1rem;
        }

        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: var(--shadow);
            transition: transform 0.2s, box-shadow 0.2s;
            animation: slideUp 0.3s ease-out;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
            padding: 8px 12px;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
        }

        .form-group input::placeholder {
            color: var(--muted);
        }

        .form-group small {
            display: block;
            margin-top: 6px;
            color: var(--muted);
            font-size: 0.875rem;
        }

        .btn {
            position: relative;
            padding: 12px 24px;
            border: 3px solid;
            border-radius: 0;
            font-size: 1rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-block;
            text-decoration: none;
            overflow: hidden;
        }

        .btn-primary {
            background: var(--accent);
            border-color: var(--accent-dark);
            color: #000;
            box-shadow: 0 4px 0 var(--accent-dark);
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 0 var(--accent-dark);
        }

        .btn-primary:active:not(:disabled) {
            transform: translateY(2px);
            box-shadow: 0 2px 0 var(--accent-dark);
        }

        .btn-secondary {
            background: var(--border);
            border-color: var(--border-light);
            color: var(--text);
            box-shadow: 0 4px 0 var(--border-light);
        }

        .btn-secondary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 0 var(--border-light);
            background: var(--border-light);
        }

        .btn-secondary:active:not(:disabled) {
            transform: translateY(2px);
            box-shadow: 0 2px 0 var(--border-light);
        }

        .btn-danger {
            background: var(--danger);
            border-color: #c01f1f;
            color: white;
            box-shadow: 0 4px 0 #c01f1f;
        }

        .btn-danger:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 0 #c01f1f;
        }

        .btn-danger:active:not(:disabled) {
            transform: translateY(2px);
            box-shadow: 0 2px 0 #c01f1f;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .btn:disabled:hover {
            transform: none;
        }

        .btn:focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 2px;
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
            color: var(--muted);
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
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 20px;
            margin-bottom: 15px;
            transition: transform 0.2s, box-shadow 0.2s;
            animation: fadeIn 0.3s ease-out;
        }

        .url-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            border-color: var(--border-light);
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
            color: var(--accent);
            font-size: 1.1rem;
            word-break: break-all;
        }

        .btn-copy {
            padding: 6px 12px;
            background: var(--border);
            border: 2px solid var(--border-light);
            border-radius: 0;
            color: var(--text);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.1s;
            box-shadow: 0 2px 0 var(--border-light);
        }

        .btn-copy:hover {
            transform: translateY(-1px);
            box-shadow: 0 3px 0 var(--border-light);
            background: var(--border-light);
        }

        .btn-copy:active {
            transform: translateY(1px);
            box-shadow: 0 1px 0 var(--border-light);
        }

        .url-original {
            margin-bottom: 12px;
        }

        .url-original a {
            color: var(--muted);
            text-decoration: none;
            font-size: 0.9rem;
            word-break: break-all;
        }

        .url-original a:hover {
            color: var(--accent);
            text-decoration: underline;
        }

        .url-meta {
            display: flex;
            gap: 15px;
            color: var(--muted);
            font-size: 0.875rem;
            flex-wrap: wrap;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--muted);
            font-style: italic;
            background: var(--bg-dark);
            border-radius: 6px;
            border: 1px dashed var(--border);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--muted);
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
            border-left: 4px solid var(--danger);
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

        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
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
            color: var(--muted);
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
            <h1>\u{1F517} URL Shortener</h1>
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
                        \u{1F504} Refresh
                    </button>
                </div>
                <div id="urlsList">
                    <div class="loading">Loading URLs...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Configuration - Using custom domain (s.idling.app)
        const OTP_AUTH_API_URL = 'https://otp-auth-service.strixuns-script-suite.workers.dev';
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
                    // Handle both old format (data.error) and RFC 7807 format (data.detail)
                    const errorMessage = data.detail || data.error || 'Failed to send OTP';
                    showToast(errorMessage, 'error');
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

                if (response.ok && (data.token || data.access_token)) {
                    // Support both old format (token) and OAuth 2.0 format (access_token)
                    authToken = data.access_token || data.token;
                    userEmail = data.email || email;
                    
                    // Store token
                    localStorage.setItem('urlShortenerToken', authToken);
                    localStorage.setItem('urlShortenerEmail', userEmail);
                    
                    showToast('Successfully signed in!', 'success');
                    stopOTPTimer();
                    showApp();
                } else {
                    // Handle both old format (data.error) and RFC 7807 format (data.detail)
                    const errorMessage = data.detail || data.error || 'Invalid OTP code';
                    showToast(errorMessage, 'error');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify & Sign In';
                    
                    // Support both old and new format for remaining attempts
                    const remainingAttempts = data.remaining_attempts || data.remainingAttempts;
                    if (remainingAttempts !== undefined) {
                        showToast(\`Remaining attempts: \${remainingAttempts}\`, 'warning');
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
                                            \u{1F4CB} Copy
                                        </button>
                                    </div>
                                    <button class="btn btn-danger" onclick="deleteUrl('\${escapeHtml(url.shortCode)}')" title="Delete">
                                        \u{1F5D1}\uFE0F Delete
                                    </button>
                                </div>
                                <div class="url-original">
                                    <a href="\${escapeHtml(url.url)}" target="_blank" rel="noopener noreferrer">
                                        \${escapeHtml(url.url)}
                                    </a>
                                </div>
                                <div class="url-meta">
                                    <span>Created: \${new Date(url.createdAt).toLocaleDateString()}</span>
                                    <span>\u2022</span>
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
    <\/script>
</body>
</html>`;
function handleStandalonePage() {
  const html = STANDALONE_HTML;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
__name(handleStandalonePage, "handleStandalonePage");
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(env, request) });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/health") {
        return handleHealth();
      }
      if (path === "/" && request.method === "GET") {
        return handleStandalonePage();
      }
      if (path === "/api/create" && request.method === "POST") {
        return handleCreateShortUrl(request, env);
      }
      if (path.startsWith("/api/info/") && request.method === "GET") {
        return handleGetUrlInfo(request, env);
      }
      if (path === "/api/list" && request.method === "GET") {
        return handleListUrls(request, env);
      }
      if (path.startsWith("/api/delete/") && request.method === "DELETE") {
        return handleDeleteUrl(request, env);
      }
      if (request.method === "GET" && path !== "/api" && !path.startsWith("/api/")) {
        return handleRedirect(request, env);
      }
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: error.message
      }), {
        status: 500,
        headers: { ...getCorsHeaders(env, request), "Content-Type": "application/json" }
      });
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
