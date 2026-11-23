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

/** DataTable column id → sort catalog compare key (destination/actions omitted). */
const COLUMN_ID_TO_SORT_KEY: Partial<Record<string, ShortUrlSortKey>> = {
  shortUrl: 'shortCode',
  shortCode: 'shortCode',
  clickCount: 'clickCount',
  lastViewedAt: 'lastViewedAt',
  createdAt: 'createdAt',
};

const SORT_KEY_TO_COLUMN_ID: Record<ShortUrlSortKey, string> = {
  shortCode: 'shortUrl',
  clickCount: 'clickCount',
  lastViewedAt: 'lastViewedAt',
  createdAt: 'createdAt',
};

function catalogIdFor(sortKey: ShortUrlSortKey, direction: 'asc' | 'desc'): string | undefined {
  return SHORT_URL_LIST_SORT_CATALOG.find(
    (r) => r.compareKey === sortKey && sortDirectionForId(r.id) === direction,
  )?.id;
}

/** Toggle sort like VirtualizedTable: same column flips asc/desc; new column picks a sensible default. */
export function toggleShortUrlListSortId(sortId: string, columnId: string): string {
  const sortKey = COLUMN_ID_TO_SORT_KEY[columnId];
  if (!sortKey) return sortId;

  const activeKey = compareKeyForSortId(sortId);
  if (activeKey === sortKey) {
    const nextDir = sortDirectionForId(sortId) === 'asc' ? 'desc' : 'asc';
    return catalogIdFor(sortKey, nextDir) ?? sortId;
  }

  const defaultDir = sortKey === 'shortCode' ? 'asc' : 'desc';
  return catalogIdFor(sortKey, defaultDir) ?? sortId;
}

export function sortHeaderFromSortId(sortId: string): {
  columnId: string;
  direction: 'asc' | 'desc';
} {
  const sortKey = compareKeyForSortId(sortId);
  return {
    columnId: SORT_KEY_TO_COLUMN_ID[sortKey],
    direction: sortDirectionForId(sortId),
  };
}