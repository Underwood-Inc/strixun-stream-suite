import { matchesSearchQueryFields } from '@strixun/search-query-parser';
import type { ShortUrlListRow } from '../types/ShortUrlListRow.js';
import { shortUrlSearchableFields } from './shortUrlSearchableText.js';

export function filterShortUrls(rows: readonly ShortUrlListRow[], query: string): ShortUrlListRow[] {
  const trimmed = query.trim();
  if (!trimmed) return [...rows];
  return rows.filter((row) => matchesSearchQueryFields(shortUrlSearchableFields(row), trimmed));
}