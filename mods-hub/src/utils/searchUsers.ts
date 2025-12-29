/**
 * Search utility for filtering users using the human-friendly search query parser
 */

import { matchesSearchQueryFields } from '@strixun/search-query-parser';
import type { UserListItem } from '../types/user';

/**
 * Filter users based on a search query
 * 
 * Searches across:
 * - userId
 * - displayName
 * - customerId
 * 
 * @param users - Array of users to filter
 * @param query - Search query string (supports quotes, AND, OR, wildcards)
 * @returns Filtered array of users
 */
export function filterUsersBySearchQuery(users: UserListItem[], query: string): UserListItem[] {
  if (!query.trim()) {
    return users;
  }
  
  return users.filter(user => {
    return matchesSearchQueryFields(
      {
        userId: user.userId,
        displayName: user.displayName || '',
        customerId: user.customerId || '',
      },
      query
    );
  });
}

