/**
 * Same-Origin Proxy for Mods API
 *
 * CRITICAL: Fixes 401 on /mods/permissions/me and /admin/* when auth cookie
 * is not sent cross-origin. Client uses baseURL=/api, paths like /mods/permissions/me
 * become /api/mods/permissions/me - this proxy forwards to mods-api.idling.app.
 *
 * Forwards all /api/* requests to mods-api.idling.app with Cookie and other headers.
 */

interface Env {
  MODS_API_URL?: string;
  VITE_MODS_API_URL?: string;
}

const MODS_API_BASE = 'https://mods-api.idling.app';

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Promise<{ path?: string | string[] }>;
}): Promise<Response> {
  const { request, env } = context;
  const params = await context.params;
  // Cloudflare [[path]] returns an array for multi-segment routes (e.g. ["mods","permissions","me"])
  const pathRaw = params.path;
  const path = Array.isArray(pathRaw) ? pathRaw.join('/') : (pathRaw ?? '');
  const apiBase = env.MODS_API_URL || env.VITE_MODS_API_URL || MODS_API_BASE;
  const targetUrl = `${apiBase.replace(/\/+$/, '')}/${path}${new URL(request.url).search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (
      key.toLowerCase() === 'cookie' ||
      key.toLowerCase() === 'authorization' ||
      key.toLowerCase() === 'content-type' ||
      key.toLowerCase() === 'accept'
    ) {
      headers.set(key, value);
    }
  });

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
  responseHeaders.set('Access-Control-Allow-Credentials', 'true');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
