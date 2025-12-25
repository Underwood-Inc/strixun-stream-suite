/**
 * URL Utilities
 * 
 * URL validation and short code generation
 */

/**
 * Generate a short code for URL
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} Short code
 */
export function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate short code format
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid
 */
export function isValidShortCode(code) {
  return /^[a-zA-Z0-9_-]{3,20}$/.test(code);
}

