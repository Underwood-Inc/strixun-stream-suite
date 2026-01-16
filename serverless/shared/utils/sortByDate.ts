/**
 * Shared date sorting utilities
 * Provides reliable sorting for any objects with date fields
 */

/**
 * Sort comparator for objects with a date field (descending - newest first)
 * Handles null, undefined, and invalid dates gracefully
 * 
 * @param dateField - The name of the date field to sort by
 * @returns A comparator function for Array.sort()
 * 
 * @example
 * versions.sort(sortByDateDesc('createdAt'));
 * mods.sort(sortByDateDesc('updatedAt'));
 */
export function sortByDateDesc<T extends Record<string, unknown>>(dateField: keyof T) {
    return (a: T, b: T): number => {
        const aValue = a[dateField];
        const bValue = b[dateField];
        
        const aTime = parseDateTime(aValue);
        const bTime = parseDateTime(bValue);
        
        return bTime - aTime; // Descending (newest first)
    };
}

/**
 * Sort comparator for objects with a date field (ascending - oldest first)
 * Handles null, undefined, and invalid dates gracefully
 * 
 * @param dateField - The name of the date field to sort by
 * @returns A comparator function for Array.sort()
 * 
 * @example
 * versions.sort(sortByDateAsc('createdAt'));
 */
export function sortByDateAsc<T extends Record<string, unknown>>(dateField: keyof T) {
    return (a: T, b: T): number => {
        const aValue = a[dateField];
        const bValue = b[dateField];
        
        const aTime = parseDateTime(aValue);
        const bTime = parseDateTime(bValue);
        
        return aTime - bTime; // Ascending (oldest first)
    };
}

/**
 * Parse a date value to a timestamp, handling various edge cases
 * Returns 0 for invalid/missing dates (sorts to end for desc, start for asc)
 */
function parseDateTime(value: unknown): number {
    if (value === null || value === undefined) {
        return 0;
    }
    
    if (typeof value === 'string') {
        const timestamp = new Date(value).getTime();
        return isNaN(timestamp) ? 0 : timestamp;
    }
    
    if (typeof value === 'number') {
        return isNaN(value) ? 0 : value;
    }
    
    if (value instanceof Date) {
        const timestamp = value.getTime();
        return isNaN(timestamp) ? 0 : timestamp;
    }
    
    return 0;
}
