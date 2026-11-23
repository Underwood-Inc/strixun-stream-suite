import type { ShortUrlListRow } from '../types/ShortUrlListRow.js';

export function shortUrlSearchableFields(
  row: ShortUrlListRow,
): Record<string, string | undefined> {
  return {
    shortCode: row.shortCode,
    url: row.url,
    shortUrl: row.shortUrl,
  };
}