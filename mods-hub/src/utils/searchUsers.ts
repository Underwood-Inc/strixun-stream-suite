/**
 * Search utility for filtering customers using the human-friendly search query parser
 */

import { matchesSearchQueryFields } from '@strixun/search-query-parser';
import type { CustomerListItem } from '../types/user';

/**
 * Filter customers based on a search query
 * 
 * Searches across:
 * - customerId
 * - displayName
 * - customerIdExternal
 * 
 * @param customers - Array of customers to filter
 * @param query - Search query string (supports quotes, AND, OR, wildcards)
 * @returns Filtered array of customers
 */
export function filterCustomersBySearchQuery(customers: CustomerListItem[], query: string): CustomerListItem[] {
  if (!query.trim()) {
    return customers;
  }
  
  return customers.filter(customer => {
    return matchesSearchQueryFields(
      {
        customerId: customer.customerId,
        displayName: customer.displayName || '',
        customerIdExternal: customer.customerIdExternal || '',
      },
      query
    );
  });
}

