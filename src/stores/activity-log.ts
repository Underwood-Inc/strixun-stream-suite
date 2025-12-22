/**
 * Activity Log Store
 * 
 * Manages log entries with virtualization support
 */

import { writable, derived } from 'svelte/store';

export type LogType = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface LogEntry {
  id: string;
  message: string;
  type: LogType;
  timestamp: Date;
  flair?: string; // Optional flair/badge text
  icon?: string; // Optional icon emoji
  metadata?: Record<string, any>; // Additional metadata
}

// Store for all log entries (max 1000 entries)
const MAX_ENTRIES = 1000;
const logEntries = writable<LogEntry[]>([]);

// Derived store for filtered entries (for search/type filtering)
export const filteredLogEntries = writable<LogEntry[]>([]);

// Store for active filters
export const logFilters = writable<{
  searchQuery: string;
  types: Set<LogType>;
}>({
  searchQuery: '',
  types: new Set(['info', 'success', 'error', 'warning', 'debug'])
});

// Derived store for visible entries (after filtering)
export const visibleLogEntries = derived(
  [logEntries, logFilters],
  ([entries, filters]) => {
    let filtered = entries;
    
    // Filter by type
    if (filters.types.size < 5) { // Only filter if not all types selected
      filtered = filtered.filter(entry => filters.types.has(entry.type));
    }
    
    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(query) ||
        entry.flair?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }
);

/**
 * Add a log entry
 */
export function addLogEntry(
  message: string,
  type: LogType = 'info',
  flair?: string,
  icon?: string,
  metadata?: Record<string, any>
): void {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    message,
    type,
    timestamp: new Date(),
    flair,
    icon,
    metadata
  };
  
  logEntries.update(entries => {
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

