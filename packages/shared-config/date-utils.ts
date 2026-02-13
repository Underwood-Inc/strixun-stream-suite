/**
 * Shared Date Utilities
 * Centralized date formatting functions used across all applications
 */

/**
 * Format date string to localized date (e.g., "1/9/2026")
 * Returns 'N/A' if date is invalid or missing
 */
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
}

/**
 * Format date string to localized date with custom options
 * Returns 'N/A' if date is invalid or missing
 */
export function formatDateWithOptions(
    dateString: string | null | undefined,
    options?: Intl.DateTimeFormatOptions
): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', options);
}

/**
 * Format date string to localized date and time (e.g., "1/9/2026, 3:45:00 PM")
 * Returns 'N/A' if date is invalid or missing
 */
export function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

/**
 * Format date string to localized time only (e.g., "3:45:00 PM")
 * Returns 'N/A' if date is invalid or missing
 */
export function formatTime(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleTimeString();
}

/**
 * Format date to ISO string for API requests
 * Returns current ISO string if date is invalid or missing
 */
export function toISOString(date?: Date | string | null): string {
    if (!date) return new Date().toISOString();
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Get current ISO timestamp
 */
export function nowISO(): string {
    return new Date().toISOString();
}

/**
 * Format date to relative time (e.g., "2m ago", "5h ago", "3d ago")
 * Returns absolute date if more than 7 days old
 * Returns 'N/A' if date is invalid or missing
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Format date for file exports (e.g., "2026-01-09")
 * Returns empty string if date is invalid or missing
 */
export function formatDateForFilename(date?: Date | string | null): string {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateString: string | null | undefined): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}
