import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';
import {
  projectPublicHostsFromEnv,
  KvLinkAggregateStore,
  AnalyticsEngineLinkViewSink,
} from '@strixun/url-shortener-core';

function analyticsSink(env) {
  if (!env.ANALYTICS_ENGINE) {
    return new AnalyticsEngineLinkViewSink({ writeDataPoint() {} });
  }
  return new AnalyticsEngineLinkViewSink(env.ANALYTICS_ENGINE, env.ANALYTICS_ENGINE_SQL);
}

/**
 * GET /api/analytics/:shortCode/views?limit=N
 */
export async function handleLinkViewHistory(request, env, shortCode) {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }

  const store = new KvLinkAggregateStore(env.URL_KV);
  const link = await store.getLink(shortCode);
  if (!link) {
    return new Response(JSON.stringify({ error: 'Short URL not found' }), {
      status: 404,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }
  if (link.userId !== auth.userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);
  const sink = analyticsSink(env);
  const views = await sink.listRecentViewsForLink(shortCode, limit);

  return new Response(JSON.stringify({ success: true, views }), {
    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
  });
}

/**
 * GET /api/analytics/summary?scope=user|global&since=
 */
export async function handleAnalyticsSummary(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'user';
  const since = url.searchParams.get('since') || undefined;
  const sink = analyticsSink(env);

  const summary = await sink.querySummary({
    userId: scope === 'user' ? auth.userId : undefined,
    since,
  });

  const catalog = projectPublicHostsFromEnv(env.SHORTENER_PUBLIC_HOSTS);
  const byHost = catalog.map((row) => ({
    hostKey: row.id,
    label: row.label,
    views: summary.find((s) => s.hostKey === row.id)?.views ?? 0,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      scope,
      since: since ?? null,
      byHost,
      raw: summary,
    }),
    {
      headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    },
  );
}