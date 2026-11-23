import { describe, expect, test } from 'vitest';
import { SHORTENER_PUBLIC_HOSTS_FROZEN } from './molecules/shortenerPublicHostsCatalog.js';
import { mergeViewIntoLinkAggregate } from './molecules/mergeViewIntoLinkAggregate.js';
import { InMemoryLinkAggregateStore } from './plugs/memory/InMemoryLinkAggregateStore.js';
import { InMemoryLinkViewEventSink } from './plugs/memory/InMemoryLinkViewEventSink.js';
import { recordLinkView } from './recipes/recordLinkView.js';

test('[FR-SS-URL-005] mergeViewIntoLinkAggregate sets lastViewedAt and clickCount', () => {
  const viewedAt = '2026-01-01T00:00:00.000Z';
  const merged = mergeViewIntoLinkAggregate({ clickCount: 2 }, { hostKey: 's-idling', viewedAt });
  expect(merged.clickCount).toBe(3);
  expect(merged.lastViewedAt).toBe(viewedAt);
});

test('[FR-SS-URL-006] recordLinkView increments viewsByHostKey per hostKey', async () => {
  const store = new InMemoryLinkAggregateStore();
  const sink = new InMemoryLinkViewEventSink();
  await store.putLink('code1', {
    shortCode: 'code1',
    userId: 'user-1',
    url: 'https://example.com',
    clickCount: 0,
  });
  await store.putUserUrlList('user-1', [{ shortCode: 'code1', url: 'https://example.com', clickCount: 0 }]);

  const deps = { catalog: SHORTENER_PUBLIC_HOSTS_FROZEN, aggregateStore: store, eventSink: sink };
  await recordLinkView(
    {
      shortCode: 'code1',
      requestHostname: 'short.army',
      viewedAt: '2026-01-02T00:00:00.000Z',
    },
    deps,
  );
  await recordLinkView(
    {
      shortCode: 'code1',
      requestHostname: 's.idling.app',
      viewedAt: '2026-01-03T00:00:00.000Z',
    },
    deps,
  );

  const link = await store.getLink('code1');
  expect(link?.viewsByHostKey).toEqual({ 'short-army': 1, 's-idling': 1 });
  expect(link?.lastViewedAt).toBe('2026-01-03T00:00:00.000Z');

  const list = await store.getUserUrlList('user-1');
  expect(list[0].viewsByHostKey).toEqual({ 'short-army': 1, 's-idling': 1 });
  expect(sink.events).toHaveLength(2);
  expect(sink.events[0].hostKey).toBe('short-army');
});