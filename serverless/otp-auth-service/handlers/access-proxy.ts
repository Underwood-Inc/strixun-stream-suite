/**
 * Same-Origin Proxy for Access API
 *
 * CRITICAL: Fixes 401 on /access/roles and other access endpoints when the auth
 * dashboard (auth.idling.app) calls access-api.idling.app cross-origin and the
 * browser doesn't send the auth_token cookie.
 *
 * By proxying through auth.idling.app/api/access/*, the request is same-origin
 * and the browser sends the auth_token cookie. Forwards to access-api.idling.app.
 */

const ACCESS_API_BASE = 'https://access-api.idling.app';

export async function handleAccessProxy(
  request: Request,
  path: string,
  env: { ACCESS_SERVICE_URL?: string }
): Promise<Response | null> {
  // Match /api/access or /api/access/*
  if (path !== '/api/access' && !path.startsWith('/api/access/')) {
    return null;
  }

  const apiBase = env.ACCESS_SERVICE_URL || ACCESS_API_BASE;
  const pathSuffix = path.replace(/^\/api\/access\/?/, '') || '';
  const targetPath = pathSuffix ? `/access/${pathSuffix}` : '/access';
  const url = new URL(request.url);
  const targetUrl = `${apiBase.replace(/\/+$/, '')}${targetPath}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'cookie' ||
      lower === 'authorization' ||
      lower === 'content-type' ||
      lower === 'accept'
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
