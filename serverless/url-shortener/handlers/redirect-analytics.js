import {
  projectPublicHostsFromEnv,
  KvLinkAggregateStore,
  AnalyticsEngineLinkViewSink,
  recordLinkView,
} from '@strixun/url-shortener-core';

function simpleUaHash(ua) {
  if (!ua) return null;
  let h = 0;
  for (let i = 0; i < ua.length; i++) {
    h = (h << 5) - h + ua.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

/** Collects a single pending view event from recordLinkView before AE flush. */
class CollectingLinkViewEventSink {
  constructor() {
    this.pending = null;
  }

  async appendView(event) {
    this.pending = event;
  }

  async listRecentViewsForLink() {
    return [];
  }

  async querySummary() {
    return [];
  }
}

/**
 * Records redirect view: KV aggregates synchronously; Analytics Engine in waitUntil.
 * @param {import('@cloudflare/workers-types').ExecutionContext} [ctx]
 */
export async function recordRedirectView(request, env, shortCode, ctx) {
  const catalog = projectPublicHostsFromEnv(env.SHORTENER_PUBLIC_HOSTS);
  const aggregateStore = new KvLinkAggregateStore(env.URL_KV);
  const collectingSink = new CollectingLinkViewEventSink();

  const viewedAt = new Date().toISOString();
  const requestUrl = new URL(request.url);
  const input = {
    shortCode,
    requestHostname: requestUrl.hostname,
    viewedAt,
    referer: request.headers.get('Referer'),
    uaHash: simpleUaHash(request.headers.get('User-Agent')),
  };

  await recordLinkView(input, { catalog, aggregateStore, eventSink: collectingSink });

  const event = collectingSink.pending;
  if (!event) return;

  const aeSink = env.ANALYTICS_ENGINE
    ? new AnalyticsEngineLinkViewSink(env.ANALYTICS_ENGINE, env.ANALYTICS_ENGINE_SQL)
    : null;

  if (aeSink && ctx?.waitUntil) {
    ctx.waitUntil(aeSink.appendView(event));
    return;
  }
  if (aeSink) {
    await aeSink.appendView(event);
  }
}