export type ShortUrlSortKey = 'createdAt' | 'clickCount' | 'lastViewedAt' | 'shortCode';

export interface ShortUrlSortCatalogRow {
  readonly id: string;
  readonly label: string;
  readonly compareKey: ShortUrlSortKey;
}

export const SHORT_URL_LIST_SORT_CATALOG: readonly ShortUrlSortCatalogRow[] = [
  { id: 'created-desc', label: 'Newest first', compareKey: 'createdAt' },
  { id: 'created-asc', label: 'Oldest first', compareKey: 'createdAt' },
  { id: 'clicks-desc', label: 'Most clicks', compareKey: 'clickCount' },
  { id: 'clicks-asc', label: 'Fewest clicks', compareKey: 'clickCount' },
  { id: 'viewed-desc', label: 'Recently used', compareKey: 'lastViewedAt' },
  { id: 'viewed-asc', label: 'Stale first', compareKey: 'lastViewedAt' },
  { id: 'code-asc', label: 'Short code A–Z', compareKey: 'shortCode' },
  { id: 'code-desc', label: 'Short code Z–A', compareKey: 'shortCode' },
] as const;

export function sortDirectionForId(sortId: string): 'asc' | 'desc' {
  return sortId.endsWith('-asc') ? 'asc' : 'desc';
}

export function compareKeyForSortId(sortId: string): ShortUrlSortKey {
  const row = SHORT_URL_LIST_SORT_CATALOG.find((r) => r.id === sortId);
  return row?.compareKey ?? 'createdAt';
}