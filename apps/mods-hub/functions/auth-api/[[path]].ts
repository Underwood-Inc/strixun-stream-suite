/**
 * Same-Origin Proxy for Auth API
 *
 * CRITICAL: Ensures auth cookie is sent reliably for /auth/me, /auth/verify-otp, etc.
 * Cross-origin fetch to auth.idling.app can fail to send/receive cookies in some browsers.
 * Proxying through mods.idling.app/auth-api/* makes all auth requests same-origin.
 */

import { proxyRequestWithCredentials } from '@strixun/api-framework';

interface Env {
  AUTH_API_URL?: string;
  VITE_AUTH_API_URL?: string;
}

const AUTH_API_BASE = 'https://auth.idling.app';

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Promise<{ path?: string | string[] }>;
}): Promise<Response> {
  const { request, env } = context;
  const params = await context.params;
  const pathRaw = params.path;
  const path = Array.isArray(pathRaw) ? pathRaw.join('/') : (pathRaw ?? '');
  const apiBase = env.AUTH_API_URL || env.VITE_AUTH_API_URL || AUTH_API_BASE;
  const targetUrl = `${apiBase.replace(/\/+$/, '')}/${path}${new URL(request.url).search}`;

  return proxyRequestWithCredentials(request, targetUrl, { forwardSetCookie: true });
}
