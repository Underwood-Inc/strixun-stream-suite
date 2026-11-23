import { getCorsHeaders } from '../utils/cors.js';
import { projectPublicHostsFromEnv } from '@strixun/url-shortener-core';

/**
 * GET /api/public-hosts — projected Canon catalog (public).
 */
export async function handleGetPublicHosts(request, env) {
  const hosts = projectPublicHostsFromEnv(env.SHORTENER_PUBLIC_HOSTS);
  return new Response(
    JSON.stringify({
      success: true,
      hosts,
    }),
    {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    },
  );
}