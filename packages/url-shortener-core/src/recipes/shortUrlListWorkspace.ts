import type { ShortenerPublicHostRow } from '../molecules/shortenerPublicHostsCatalog.js';
import {
  compareKeyForSortId,
  sortDirectionForId,
} from '../molecules/shortUrlListSortCatalog.js';
import { filterShortUrls } from '../molecules/filterShortUrls.js';
import { pickTopShortUrls } from '../molecules/pickTopShortUrls.js';
import { sortShortUrls } from '../molecules/sortShortUrls.js';
import type { ShortUrlListRow } from '../types/ShortUrlListRow.js';

export interface ShortUrlListWorkspaceInput {
  rows: readonly ShortUrlListRow[];
  query: string;
  sortId: string;
  catalog: readonly ShortenerPublicHostRow[];
  topLimit?: number;
}

export interface ShortUrlListWorkspaceOutput {
  filtered: ShortUrlListRow[];
  sorted: ShortUrlListRow[];
  topByClicks: ShortUrlListRow[];
  topByRecency: ShortUrlListRow[];
  totalCount: number;
}

export function shortUrlListWorkspace(input: ShortUrlListWorkspaceInput): ShortUrlListWorkspaceOutput {
  const topLimit = input.topLimit ?? 5;
  const filtered = filterShortUrls(input.rows, input.query);
  const sortKey = compareKeyForSortId(input.sortId);
  const direction = sortDirectionForId(input.sortId);
  const sorted = sortShortUrls(filtered, sortKey, direction);
  const topByClicks = pickTopShortUrls(input.rows, 'clickCount', topLimit);
  const topByRecency = pickTopShortUrls(input.rows, 'lastViewedAt', topLimit);
  return {
    filtered,
    sorted,
    topByClicks,
    topByRecency,
    totalCount: input.rows.length,
  };
}