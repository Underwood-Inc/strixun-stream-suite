import type { ShortUrlListRow } from '../types/ShortUrlListRow.js';
import type { ShortUrlSortKey } from './shortUrlListSortCatalog.js';

function compareValues(
  a: string | number | undefined,
  b: string | number | undefined,
  direction: 'asc' | 'desc',
): number {
  const mult = direction === 'asc' ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * mult;
  }
  return String(a).localeCompare(String(b)) * mult;
}

export function sortShortUrls(
  rows: readonly ShortUrlListRow[],
  sortKey: ShortUrlSortKey,
  direction: 'asc' | 'desc',
): ShortUrlListRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sortKey) {
      case 'createdAt':
        return compareValues(a.createdAt, b.createdAt, direction);
      case 'clickCount':
        return compareValues(a.clickCount, b.clickCount, direction);
      case 'lastViewedAt':
        return compareValues(a.lastViewedAt, b.lastViewedAt, direction);
      case 'shortCode':
        return compareValues(a.shortCode, b.shortCode, direction);
      default:
        return 0;
    }
  });
  return copy;
}