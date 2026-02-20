/**
 * Same-Origin Proxy for Mods API
 *
 * CRITICAL: Fixes 401 on /mods/permissions/me and /admin/* when auth cookie
 * is not sent cross-origin. Client uses baseURL=/api, paths like /mods/permissions/me
 * become /api/mods/permissions/me - this proxy forwards to mods-api.idling.app.
 */

import { proxyRequestWithCredentials } from '@strixun/api-framework';

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
  const pathRaw = params.path;
  const path = Array.isArray(pathRaw) ? pathRaw.join('/') : (pathRaw ?? '');
  const apiBase = env.MODS_API_URL || env.VITE_MODS_API_URL || MODS_API_BASE;
  const targetUrl = `${apiBase.replace(/\/+$/, '')}/${path}${new URL(request.url).search}`;

  return proxyRequestWithCredentials(request, targetUrl);
}
