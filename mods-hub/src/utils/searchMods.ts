/**
 * Search utility for filtering mods using the human-friendly search query parser
 */

import { matchesSearchQueryFields } from '../../../shared-components/search-query-parser/index.js';
import type { ModMetadata } from '../types/mod';

/**
 * Filter mods based on a search query
 * 
 * Searches across:
 * - Title
 * - Description
 * - Author email
 * - Author display name
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
        authorEmail: mod.authorEmail,
        authorDisplayName: mod.authorDisplayName || '',
        category: mod.category,
        tags: mod.tags.join(' '),
        status: mod.status
      },
      query
    );
  });
}

