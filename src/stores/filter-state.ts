/**
 * Reusable Filter State Store
 * 
 * Generic, agnostic filter state management system that can be reused
 * across different components for filtering/searching functionality.
 */

import { writable, derived, type Readable, type Writable } from 'svelte/store';

export interface FilterState<T extends string = string> {
  searchQuery: string;
  activeFilters: Set<T>;
  allFilters: Set<T>;
}

export interface FilterStateOptions<T extends string = string> {
  initialFilters?: T[];
  initialSearchQuery?: string;
}

/**
 * Create a reusable filter state store
 * 
 * @param options Configuration options
 * @returns Filter state store and helper functions
 */
export function createFilterState<T extends string = string>(
  options: FilterStateOptions<T> = {}
): {
  filters: Writable<FilterState<T>>;
  isFilterActive: (filter: T) => Readable<boolean>;
  toggleFilter: (filter: T) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  resetFilters: () => void;
  hasActiveFilters: Readable<boolean>;
} {
  const allFilters = new Set<T>(options.initialFilters || []);
  const initialFilters = new Set<T>(options.initialFilters || []);
  
  const filters = writable<FilterState<T>>({
    searchQuery: options.initialSearchQuery || '',
    activeFilters: new Set(initialFilters),
    allFilters
  });

  // Derived store to check if a specific filter is active
  function isFilterActive(filter: T): Readable<boolean> {
    return derived(filters, $filters => $filters.activeFilters.has(filter));
  }

  // Toggle a filter on/off
  function toggleFilter(filter: T): void {
    filters.update(state => {
      const newActiveFilters = new Set(state.activeFilters);
      if (newActiveFilters.has(filter)) {
        newActiveFilters.delete(filter);
      } else {
        newActiveFilters.add(filter);
      }
      return {
        ...state,
        activeFilters: newActiveFilters
      };
    });
  }

  // Set search query
  function setSearchQuery(query: string): void {
    filters.update(state => ({
      ...state,
      searchQuery: query
    }));
  }

  // Clear search query
  function clearSearch(): void {
    filters.update(state => ({
      ...state,
      searchQuery: ''
    }));
  }

  // Reset all filters to initial state
  function resetFilters(): void {
    filters.update(state => ({
      ...state,
      activeFilters: new Set(initialFilters),
      searchQuery: ''
    }));
  }

  // Derived store to check if any filters are active (excluding search)
  const hasActiveFilters = derived(
    filters,
    $filters => {
      // Check if all filters are active (meaning no filtering is happening)
      return $filters.activeFilters.size < $filters.allFilters.size;
    }
  );

  return {
    filters,
    isFilterActive,
    toggleFilter,
    setSearchQuery,
    clearSearch,
    resetFilters,
    hasActiveFilters
  };
}

