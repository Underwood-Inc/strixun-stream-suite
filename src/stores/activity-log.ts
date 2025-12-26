/**
 * Activity Log Store
 * 
 * SIMPLIFIED - Direct, working implementation
 * No complex queueing, no bullshit - just works
 */

import { writable, derived, get } from 'svelte/store';
import { createFilterState } from './filter-state';

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface LogEntry {
  id: string;
  message: string;
  type: LogType;
  timestamp: Date;
  flair?: string;
  icon?: string;
  metadata?: Record<string, any>;
  count?: number;
}

// Store for all log entries (max 1000 entries)
const MAX_ENTRIES = 1000;
const logEntries = writable<LogEntry[]>([]);

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
    const activeFilterCount = filters.activeFilters.size;
    const totalFilterCount = filters.allFilters.size;
    
    if (activeFilterCount > 0 && activeFilterCount < totalFilterCount) {
      filtered = filtered.filter(entry => filters.activeFilters.has(entry.type));
    }
    
    // Filter by search query
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
  
  processedQuery = processedQuery.trim();
  if (!processedQuery) {
    return quotedPhrases.length > 0;
  }
  
  // Split by | for OR groups, then by space for AND within groups
  const orGroups = processedQuery.split('|').map(g => g.trim()).filter(g => g);
  
  return orGroups.some(orGroup => {
    const andTerms = orGroup.split(/\s+/).filter(t => t);
    return andTerms.every(term => {
      if (term.endsWith('*')) {
        const prefix = term.slice(0, -1).toLowerCase();
        return searchText.includes(prefix);
      }
      return searchText.includes(term.toLowerCase());
    });
  });
}

/**
 * Add a log entry - SIMPLIFIED, DIRECT, WORKS
 */
export function addLogEntry(
  message: string,
  type: LogType = 'info',
  flair?: string,
  icon?: string,
  metadata?: Record<string, any>
): void {
  // Get current entries
  const currentEntries = get(logEntries);
  
  // Check if first entry is a duplicate
  const firstEntry = currentEntries[0];
  if (
    firstEntry &&
    firstEntry.message === message &&
    firstEntry.type === type &&
    firstEntry.flair === flair &&
    firstEntry.icon === icon
  ) {
    // Merge with existing entry
    const updatedEntry: LogEntry = {
      ...firstEntry,
      timestamp: new Date(),
      count: (firstEntry.count || 1) + 1
    };
    const newEntries = [updatedEntry, ...currentEntries.slice(1)];
    logEntries.set(newEntries);
    return;
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
  
  const newEntries = [entry, ...currentEntries];
  // Keep only the most recent MAX_ENTRIES
  const limitedEntries = newEntries.slice(0, MAX_ENTRIES);
  logEntries.set(limitedEntries);
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
  return get(logEntries);
}

export { logEntries };
