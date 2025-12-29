/**
 * Search utility for filtering mods using the human-friendly search query parser
 */

import { matchesSearchQueryFields } from '@strixun/search-query-parser';
import type { ModMetadata } from '../types/mod';

/**
 * Filter mods based on a search query
 * 
 * Searches across:
 * - Title
 * - Description
 * - Author display name (never search by email)
 * - Category
 * - Tags (joined)
 * - Status
 * 
 * @param mods - Array of mods to filter
 * @param query - Search query string (supports quotes, AND, OR, wildcards)
 * @returns Filtered array of mods
 */
export function filterModsBySearchQuery(mods: ModMetadata[], query: string): ModMetadata[] {
  if (!query.trim()) {
    return mods;
  }
  
  return mods.filter(mod => {
    return matchesSearchQueryFields(
      {
        title: mod.title,
        description: mod.description,
        authorDisplayName: mod.authorDisplayName || '', // Never search by email
        category: mod.category,
        tags: mod.tags.join(' '),
        status: mod.status
      },
      query
    );
  });
}

