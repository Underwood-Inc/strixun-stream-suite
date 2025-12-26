/**
 * Activity Log Store
 * 
 * Manages log entries with virtualization support
 */

import { writable, derived } from 'svelte/store';
import { createFilterState } from './filter-state';

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface LogEntry {
  id: string;
  message: string;
  type: LogType;
  timestamp: Date;
  flair?: string; // Optional flair/badge text
  icon?: string; // Optional icon emoji
  metadata?: Record<string, any>; // Additional metadata
  count?: number; // Count of duplicate consecutive messages
}

// Store for all log entries (max 1000 entries)
const MAX_ENTRIES = 1000;
const logEntries = writable<LogEntry[]>([]);

// Derived store for filtered entries (for search/type filtering)
export const filteredLogEntries = writable<LogEntry[]>([]);

// Create reusable filter state for log types
const logFilterState = createFilterState<LogType>({
  initialFilters: ['info', 'success', 'error', 'warning', 'debug']
});

// Export the filter store and helpers
export const logFilters = logFilterState.filters;
export const isLogTypeActive = logFilterState.isFilterActive;
export const toggleLogTypeFilter = logFilterState.toggleFilter;
export const setLogSearchQuery = logFilterState.setSearchQuery;
export const clearLogSearch = logFilterState.clearSearch;
export const resetLogFilters = logFilterState.resetFilters;

// Derived store for visible entries (after filtering)
export const visibleLogEntries = derived(
  [logEntries, logFilters],
  ([entries, filters]) => {
    if (!entries || entries.length === 0) {
      return [];
    }
    
    let filtered = entries;
    
    // Filter by type - only filter if some (but not all) types are active
    // If all are active OR all are inactive, show everything (no filtering)
    const activeFilterCount = filters.activeFilters.size;
    const totalFilterCount = filters.allFilters.size;
    
    // Only apply type filtering if some (but not all) filters are active
    if (activeFilterCount > 0 && activeFilterCount < totalFilterCount) {
      filtered = filtered.filter(entry => filters.activeFilters.has(entry.type));
    }
    
    // Filter by search query with advanced syntax
    const searchQuery = filters.searchQuery?.trim() || '';
    if (searchQuery) {
      filtered = filtered.filter(entry => {
        return matchesSearchQuery(entry, searchQuery);
      });
    }
    
    return filtered;
  }
);

/**
 * Advanced search query matching
 * Supports:
 * - "exact phrase" - matches exact phrase in quotes
 * - word1 word2 - matches entries containing both words (AND)
 * - word1 | word2 - matches entries containing either word (OR)
 * - word* - wildcard matching
 */
function matchesSearchQuery(entry: LogEntry, query: string): boolean {
  const message = entry.message.toLowerCase();
  const flair = entry.flair?.toLowerCase() || '';
  const searchText = `${message} ${flair}`;
  
  // Handle quoted exact phrases
  const quotedPhrases: string[] = [];
  let processedQuery = query.replace(/"([^"]+)"/g, (match, phrase) => {
    quotedPhrases.push(phrase.toLowerCase());
    return '';
  });
  
  // Check exact phrases first
  for (const phrase of quotedPhrases) {
    if (!searchText.includes(phrase)) {
      return false;
    }
  }
  
  // Process remaining query (AND/OR logic)
  processedQuery = processedQuery.trim();
  if (!processedQuery) {
    return quotedPhrases.length > 0; // Only quoted phrases, all matched
  }
  
  // Split by | for OR groups, then by space for AND within groups
  const orGroups = processedQuery.split('|').map(g => g.trim()).filter(g => g);
  
  // If any OR group matches, the entry matches
  return orGroups.some(orGroup => {
    const andTerms = orGroup.split(/\s+/).filter(t => t);
    // All AND terms must match
    return andTerms.every(term => {
      // Support wildcard * at end
      if (term.endsWith('*')) {
        const prefix = term.slice(0, -1).toLowerCase();
        return searchText.includes(prefix);
      }
      return searchText.includes(term.toLowerCase());
    });
  });
}

/**
 * Add a log entry
 * Merges duplicate consecutive messages (like a browser console would)
 */
export function addLogEntry(
  message: string,
  type: LogType = 'info',
  flair?: string,
  icon?: string,
  metadata?: Record<string, any>
): void {
  logEntries.update(entries => {
    // Check if the first entry is a duplicate (same message, type, flair, icon)
    const firstEntry = entries[0];
    if (
      firstEntry &&
      firstEntry.message === message &&
      firstEntry.type === type &&
      firstEntry.flair === flair &&
      firstEntry.icon === icon
    ) {
      // Merge with existing entry - increment count and update timestamp
      const updatedEntry: LogEntry = {
        ...firstEntry,
        timestamp: new Date(), // Update to most recent timestamp
        count: (firstEntry.count || 1) + 1
      };
      return [updatedEntry, ...entries.slice(1)];
    }
    
    // New unique entry
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      timestamp: new Date(),
      flair,
      icon,
      metadata,
      count: 1
    };
    
    const newEntries = [entry, ...entries];
    // Keep only the most recent MAX_ENTRIES
    return newEntries.slice(0, MAX_ENTRIES);
  });
}

/**
 * Clear all log entries
 */
export function clearLogEntries(): void {
  logEntries.set([]);
}

/**
 * Get log entries (for external access)
 */
export function getLogEntries(): LogEntry[] {
  let entries: LogEntry[] = [];
  logEntries.subscribe(value => {
    entries = value;
  })();
  return entries;
}

export { logEntries };

