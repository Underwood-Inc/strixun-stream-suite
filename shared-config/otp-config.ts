/**
 * OTP Configuration
 * 
 * Centralized configuration for OTP (One-Time Password) settings.
 * Change these values to modify OTP behavior across the entire codebase.
 * 
 * This ensures consistency between:
 * - Backend OTP generation
 * - Backend OTP validation
 * - Frontend OTP input components
 * - API documentation
 * - Error messages
 */

/**
 * OTP code length (number of digits)
 * 
 * Security considerations:
 * - 6 digits = 1,000,000 combinations
 * - 9 digits = 1,000,000,000 combinations (1000x more secure)
 * 
 * Industry standards:
 * - Most services use 6 digits (SMS, email verification)
 * - Some high-security services use 8-10 digits
 */
export const OTP_LENGTH = 9;

/**
 * Maximum value for OTP generation
 * For 6 digits: 1,000,000 (10^6)
 * For 9 digits: 1,000,000,000 (10^9)
 */
export const OTP_MAX_VALUE = Math.pow(10, OTP_LENGTH);

/**
 * OTP regex pattern for validation
 * Matches exactly N digits where N = OTP_LENGTH
 */
export const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

/**
 * OTP HTML input pattern attribute
 * For use in HTML input elements: pattern="[0-9]{N}"
 */
export const OTP_HTML_PATTERN = `[0-9]{${OTP_LENGTH}}`;

/**
 * OTP placeholder text
 * Shows example OTP code format
 */
export const OTP_PLACEHOLDER = '0'.repeat(OTP_LENGTH);

/**
 * Human-readable OTP length description
 * For use in UI labels and error messages
 */
export const OTP_LENGTH_DESCRIPTION = `${OTP_LENGTH}-digit`;

/**
 * Total number of possible OTP combinations
 * For use in documentation and security descriptions
 */
export const OTP_COMBINATIONS = OTP_MAX_VALUE;

/**
 * Formatted OTP combinations count (with commas)
 * For use in documentation: "1,000,000,000 combinations"
 */
export const OTP_COMBINATIONS_FORMATTED = OTP_COMBINATIONS.toLocaleString('en-US');

