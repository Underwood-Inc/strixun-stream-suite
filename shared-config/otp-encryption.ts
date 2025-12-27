/**
 * Centralized Service Encryption Key Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for retrieving the SERVICE_ENCRYPTION_KEY.
 * All apps should import from this file to ensure consistent key retrieval.
 * 
 * SECURITY: The key is NEVER stored in source code or browser storage.
 * It must be provided via environment variables at build time.
 * 
 * To configure the key:
 * 1. Set VITE_SERVICE_ENCRYPTION_KEY in your .env file (or build environment)
 * 2. The key must match server-side SERVICE_ENCRYPTION_KEY
 * 3. Never commit .env files with real keys to version control
 * 
 * To get the server-side key:
 *   cd serverless/otp-auth-service
 *   wrangler secret list
 * 
 * To set the server-side key:
 *   cd serverless/otp-auth-service
 *   wrangler secret put SERVICE_ENCRYPTION_KEY
 */

/**
 * Get SERVICE_ENCRYPTION_KEY
 * 
 * SECURITY: This function retrieves the key from secure sources only:
 * 1. Environment variables (VITE_SERVICE_ENCRYPTION_KEY) - PRIMARY
 * 2. Window function (for runtime injection in development only) - FALLBACK
 * 
 * The key is NEVER:
 * - Stored in source code
 * - Stored in localStorage/sessionStorage
 * - Hardcoded as a constant
 * 
 * @returns The SERVICE_ENCRYPTION_KEY, or undefined if not found
 */
export function getOtpEncryptionKey(): string | undefined {
  // Priority 1: Environment variable (build-time injection - SECURE)
  // This is the PRIMARY and RECOMMENDED method
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    const envKey = env.VITE_SERVICE_ENCRYPTION_KEY;
    if (envKey && typeof envKey === 'string' && envKey.length >= 32) {
      return envKey;
    }
  }

  // Priority 2: Window function (runtime injection - DEVELOPMENT ONLY)
  // This is a fallback for development/testing scenarios
  // WARNING: Only use this in development, never in production
  if (typeof window !== 'undefined' && (window as any).getOtpEncryptionKey) {
    const key = (window as any).getOtpEncryptionKey();
    if (key && typeof key === 'string' && key.length >= 32) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[SECURITY] Using window.getOtpEncryptionKey() in production is not recommended. Use environment variables instead.');
      }
      return key;
    }
  }

  // If no key found, return undefined (OTP core will throw clear error)
  // This ensures we fail securely rather than using an invalid key
  return undefined;
}

