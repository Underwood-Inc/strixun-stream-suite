/**
 * Same-Origin Proxy for Feature Flags API
 *
 * Fixes 401 on PUT /v1/flags/.../state when flags.idling.app calls
 * flags-api.idling.app cross-origin and the browser does not send auth_token.
 * Proxying through /flags-api/* forwards the Cookie header to flags-api.idling.app.
 */

import { proxyRequestWithCredentials } from '@strixun/api-framework';

interface Env {
  FLAGS_API_URL?: string;
  VITE_FLAGS_API_URL?: string;
}

const FLAGS_API_BASE = 'https://flags-api.idling.app';

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Promise<{ path?: string | string[] }>;
}): Promise<Response> {
  const { request, env } = context;
  const params = await context.params;
  const pathRaw = params.path;
  const path = Array.isArray(pathRaw) ? pathRaw.join('/') : (pathRaw ?? '');
  const apiBase = env.FLAGS_API_URL || env.VITE_FLAGS_API_URL || FLAGS_API_BASE;
  const targetUrl = `${apiBase.replace(/\/+$/, '')}/${path}${new URL(request.url).search}`;

  return proxyRequestWithCredentials(request, targetUrl);
}