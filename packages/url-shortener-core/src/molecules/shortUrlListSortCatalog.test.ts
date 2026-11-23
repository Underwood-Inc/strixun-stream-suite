import { describe, expect, test } from 'vitest';
import {
  sortHeaderFromSortId,
  toggleShortUrlListSortId,
} from './shortUrlListSortCatalog.js';

test('[FR-SS-URL-008] toggleShortUrlListSortId flips direction on same column', () => {
  expect(toggleShortUrlListSortId('clicks-desc', 'clickCount')).toBe('clicks-asc');
  expect(toggleShortUrlListSortId('clicks-asc', 'clickCount')).toBe('clicks-desc');
});

test('[FR-SS-URL-008] toggleShortUrlListSortId maps short link column to short code sort', () => {
  expect(toggleShortUrlListSortId('viewed-desc', 'shortUrl')).toBe('code-asc');
  expect(toggleShortUrlListSortId('code-asc', 'shortUrl')).toBe('code-desc');
});

test('[FR-SS-URL-008] toggleShortUrlListSortId ignores non-sortable columns', () => {
  expect(toggleShortUrlListSortId('viewed-desc', 'url')).toBe('viewed-desc');
  expect(toggleShortUrlListSortId('viewed-desc', 'actions')).toBe('viewed-desc');
});

test('[FR-SS-URL-008] sortHeaderFromSortId reflects active column and direction', () => {
  expect(sortHeaderFromSortId('clicks-desc')).toEqual({
    columnId: 'clickCount',
    direction: 'desc',
  });
  expect(sortHeaderFromSortId('code-asc')).toEqual({
    columnId: 'shortUrl',
    direction: 'asc',
  });
});