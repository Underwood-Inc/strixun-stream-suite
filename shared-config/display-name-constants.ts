/**
 * Display Name Validation Constants
 * 
 * Centralized configuration for display name validation rules.
 * Change these values to modify display name behavior across the entire codebase.
 * 
 * This ensures consistency between:
 * - Server-side validation (otp-auth-service)
 * - Client-side validation (mods-hub)
 * - Error messages
 * - API documentation
 * - UI components
 */

/**
 * Minimum display name length (in characters)
 */
export const DISPLAY_NAME_MIN_LENGTH = 3;

/**
 * Maximum display name length (in characters)
 */
export const DISPLAY_NAME_MAX_LENGTH = 50;

/**
 * Maximum number of words allowed in a display name
 * This supports dash-separated names (e.g., "Swift-Bold" counts as one word)
 */
export const DISPLAY_NAME_MAX_WORDS = 8;
