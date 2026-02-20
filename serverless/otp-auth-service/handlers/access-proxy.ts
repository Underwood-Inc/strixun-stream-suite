/**
 * Same-Origin Proxy for Access API
 *
 * CRITICAL: Fixes 401 on /access/roles and other access endpoints when the auth
 * dashboard (auth.idling.app) calls access-api.idling.app cross-origin and the
 * browser doesn't send the auth_token cookie.
 *
 * By proxying through auth.idling.app/api/access/*, the request is same-origin
 * and the browser sends the auth_token cookie.
 */

import { proxyRequestWithCredentials } from '@strixun/api-framework';

const ACCESS_API_BASE = 'https://access-api.idling.app';

export async function handleAccessProxy(
  request: Request,
  path: string,
  env: { ACCESS_SERVICE_URL?: string }
): Promise<Response | null> {
  if (path !== '/api/access' && !path.startsWith('/api/access/')) {
    return null;
  }

  const apiBase = env.ACCESS_SERVICE_URL || ACCESS_API_BASE;
  const pathSuffix = path.replace(/^\/api\/access\/?/, '') || '';
  const targetPath = pathSuffix ? `/access/${pathSuffix}` : '/access';
  const url = new URL(request.url);
  const targetUrl = `${apiBase.replace(/\/+$/, '')}${targetPath}${url.search}`;

  return proxyRequestWithCredentials(request, targetUrl);
}
