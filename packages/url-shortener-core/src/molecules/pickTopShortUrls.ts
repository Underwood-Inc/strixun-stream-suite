import type { ShortUrlListRow } from '../types/ShortUrlListRow.js';
import { sortShortUrls } from './sortShortUrls.js';

export type TopShortUrlMetric = 'clickCount' | 'lastViewedAt';

export function pickTopShortUrls(
  rows: readonly ShortUrlListRow[],
  metric: TopShortUrlMetric,
  limit = 5,
): ShortUrlListRow[] {
  let pool = [...rows];
  if (metric === 'lastViewedAt') {
    pool = pool.filter((r) => r.lastViewedAt);
  }
  const sorted = sortShortUrls(pool, metric, 'desc');
  return sorted.slice(0, limit);
}