/**
 * DEPRECATED: Service Key Encryption Removed
 * 
 * Service key encryption has been removed from the codebase.
 * It was obfuscation only (key is in frontend bundle), not real security.
 * 
 * HTTPS provides transport security for OTP requests.
 * Real security comes from:
 * - API key requirements (for third-party apps)
 * - Origin whitelisting (for internal apps)
 * - Rate limiting
 * - OTP expiration and single-use properties
 * 
 * This file is kept for backward compatibility but the function returns undefined.
 * All callers should be updated to not use service key encryption.
 * 
 * @deprecated Service key encryption removed - returns undefined
 */
export function getOtpEncryptionKey(): undefined {
  console.warn('[DEPRECATED] getOtpEncryptionKey() - Service key encryption removed. HTTPS provides transport security.');
  return undefined;
}

