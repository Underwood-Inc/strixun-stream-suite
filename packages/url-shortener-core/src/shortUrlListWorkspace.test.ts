import { describe, expect, test } from 'vitest';
import { SHORTENER_PUBLIC_HOSTS_FROZEN } from './molecules/shortenerPublicHostsCatalog.js';
import { filterShortUrls } from './molecules/filterShortUrls.js';
import { sortShortUrls } from './molecules/sortShortUrls.js';
import { pickTopShortUrls } from './molecules/pickTopShortUrls.js';
import { hostViewBarSeries } from './molecules/hostViewBarSeries.js';
import { shortUrlListWorkspace } from './recipes/shortUrlListWorkspace.js';
import type { ShortUrlListRow } from './types/ShortUrlListRow.js';

const rows: ShortUrlListRow[] = [
  {
    shortCode: 'aaa',
    url: 'https://example.com/long',
    shortUrl: 'https://s.idling.app/aaa',
    createdAt: '2026-01-01T00:00:00.000Z',
    clickCount: 10,
    lastViewedAt: '2026-01-10T00:00:00.000Z',
    viewsByHostKey: { 's-idling': 7, 'short-army': 3 } as Record<string, number>,
  },
  {
    shortCode: 'bbb',
    url: 'https://other.test/path',
    shortUrl: 'https://s.idling.app/bbb',
    createdAt: '2026-01-05T00:00:00.000Z',
    clickCount: 2,
    viewsByHostKey: { 's-idling': 2 },
  },
];

test('[FR-SS-URL-007] filterShortUrls matches short code and destination', () => {
  expect(filterShortUrls(rows, 'aaa')).toHaveLength(1);
  expect(filterShortUrls(rows, '"example.com"')).toHaveLength(1);
  expect(filterShortUrls(rows, 'zzz')).toHaveLength(0);
});

test('[FR-SS-URL-008] sortShortUrls orders by clicks desc', () => {
  const sorted = sortShortUrls(rows, 'clickCount', 'desc');
  expect(sorted[0].shortCode).toBe('aaa');
});

test('[FR-SS-URL-011] pickTopShortUrls returns click leaders', () => {
  const top = pickTopShortUrls(rows, 'clickCount', 1);
  expect(top[0].shortCode).toBe('aaa');
});

test('[FR-SS-URL-010] hostViewBarSeries aligns with catalog order', () => {
  const catalog = SHORTENER_PUBLIC_HOSTS_FROZEN.slice(0, 2);
  const series = hostViewBarSeries({ 's-idling': 5 }, catalog);
  expect(series).toHaveLength(2);
  expect(series[0].value).toBeGreaterThanOrEqual(0);
});

test('[FR-SS-URL-008] shortUrlListWorkspace recipe combines filter and sort', () => {
  const out = shortUrlListWorkspace({
    rows,
    query: 'other',
    sortId: 'clicks-desc',
    catalog: SHORTENER_PUBLIC_HOSTS_FROZEN,
  });
  expect(out.sorted).toHaveLength(1);
  expect(out.sorted[0].shortCode).toBe('bbb');
  expect(out.topByClicks[0].shortCode).toBe('aaa');
});